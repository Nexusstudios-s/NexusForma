"""Nexus Forma: avisos globales y mensajería privada de soporte.

Solo se accede mediante server.py (Firebase ID token validado por Identity Toolkit).
No se sirve este módulo como archivo web: server.py bloquea .py y los archivos privados.
"""
import json
import re
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlsplit

_UID = re.compile(r'^[A-Za-z0-9:_-]{1,128}$')
_MESSAGE_ID = re.compile(r'^[0-9a-f-]{36}$')
_ACTIVE_STAFF = ('soporte', 'atencion')
_schema_lock = threading.Lock()
_schema_ready = set()


def utcnow():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds')


def ensure_schema(path):
    key = str(path)
    if key in _schema_ready:
        return
    with _schema_lock:
        if key in _schema_ready:
            return
        with sqlite3.connect(path, timeout=20) as db:
            db.executescript('''
        CREATE TABLE IF NOT EXISTS nx_support_roles (
            user_id TEXT PRIMARY KEY, role TEXT NOT NULL CHECK(role IN ('soporte','atencion')),
            email TEXT NOT NULL DEFAULT '', assigned_by TEXT NOT NULL, assigned_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS nx_support_threads (
            client_id TEXT PRIMARY KEY, client_name TEXT NOT NULL DEFAULT '',
            client_email TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
            client_seen_at TEXT NOT NULL DEFAULT '', staff_seen_at TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS nx_support_messages (
            id TEXT PRIMARY KEY, client_id TEXT NOT NULL, author_id TEXT NOT NULL,
            author_role TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL,
            edited_at TEXT NOT NULL DEFAULT '', deleted INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_nx_support_messages_thread ON nx_support_messages (client_id, created_at);
        CREATE TABLE IF NOT EXISTS nx_announcements (
            id TEXT PRIMARY KEY, title TEXT NOT NULL, message TEXT NOT NULL,
            published_at TEXT NOT NULL, author_id TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS nx_announcement_reads (
            user_id TEXT NOT NULL, announcement_id TEXT NOT NULL, read_at TEXT NOT NULL,
            PRIMARY KEY(user_id, announcement_id)
        );
        ''')

        _schema_ready.add(key)

def _conn(path):
    db = sqlite3.connect(path, timeout=20)
    db.row_factory = sqlite3.Row
    return db


def _staff_role(db, user_id, admin):
    if admin:
        return 'admin'
    row = db.execute('SELECT role FROM nx_support_roles WHERE user_id = ?', (user_id,)).fetchone()
    return row['role'] if row else 'cliente'


def _json_message(row):
    return {
        'id': row['id'], 'clientId': row['client_id'], 'authorId': row['author_id'],
        'authorRole': row['author_role'], 'body': '' if row['deleted'] else row['body'],
        'createdAt': row['created_at'], 'editedAt': row['edited_at'],
        'deleted': bool(row['deleted']),
    }


def handle(handler, method, server):
    """Returns True when this handler dealt with the /api/community path."""
    url = urlsplit(handler.path)
    path = url.path
    if not path.startswith('/api/community/'):
        return False
    identity = handler.feedback_identity()
    if identity is None:
        return True
    uid = identity['localId']
    is_admin = server.feedback_is_admin(identity)
    ensure_schema(server.USAGE_DB)
    with _conn(server.USAGE_DB) as db:
        role = _staff_role(db, uid, is_admin)
        staff = role in ('admin', *_ACTIVE_STAFF)
        if method == 'GET' and path == '/api/community/bootstrap':
            rows = db.execute('''SELECT a.id,a.title,a.message,a.published_at,r.read_at
                FROM nx_announcements a LEFT JOIN nx_announcement_reads r
                ON r.user_id=? AND r.announcement_id=a.id
                ORDER BY a.published_at DESC LIMIT 40''', (uid,)).fetchall()
            announcements = [{'id': row['id'], 'title': row['title'], 'message': row['message'],
                              'createdAt': row['published_at'], 'read': bool(row['read_at'])} for row in rows]
            availability = db.execute('SELECT COUNT(*) FROM nx_support_roles').fetchone()[0]
            if staff:
                unread = db.execute('''SELECT COUNT(*) FROM nx_support_messages m
                    JOIN nx_support_threads t ON t.client_id=m.client_id
                    WHERE m.author_role='cliente' AND m.deleted=0 AND m.created_at>t.staff_seen_at''').fetchone()[0]
            else:
                seen = db.execute('SELECT client_seen_at FROM nx_support_threads WHERE client_id=?', (uid,)).fetchone()
                unread = db.execute('''SELECT COUNT(*) FROM nx_support_messages
                    WHERE client_id=? AND author_id<>? AND deleted=0 AND created_at>?''',
                    (uid, uid, seen['client_seen_at'] if seen else '')).fetchone()[0]
            handler.send_json(200, {'role': role, 'supportAvailable': availability > 0,
                                    'announcements': announcements, 'unreadSupport': unread})
            return True

        if method == 'GET' and path == '/api/community/roles':
            if not is_admin:
                handler.send_json(403, {'error': 'Solo administradores pueden ver roles.'}); return True
            rows = db.execute('SELECT user_id, role, email, assigned_at FROM nx_support_roles ORDER BY assigned_at DESC').fetchall()
            handler.send_json(200, {'roles': [{'userId': r['user_id'], 'role': r['role'],
                                                'email': r['email'], 'assignedAt': r['assigned_at']} for r in rows]})
            return True

        if method == 'GET' and path == '/api/community/threads':
            if not staff:
                handler.send_json(403, {'error': 'Solo soporte y atención pueden ver otras conversaciones.'}); return True
            rows = db.execute('''SELECT t.*, (SELECT body FROM nx_support_messages m WHERE m.client_id=t.client_id
                    AND m.deleted=0 ORDER BY created_at DESC LIMIT 1) AS preview,
                    (SELECT COUNT(*) FROM nx_support_messages m WHERE m.client_id=t.client_id
                    AND m.author_role='cliente' AND m.deleted=0 AND m.created_at>t.staff_seen_at) AS unread
                FROM nx_support_threads t ORDER BY t.updated_at DESC LIMIT 100''').fetchall()
            handler.send_json(200, {'threads': [{'clientId': r['client_id'], 'name': r['client_name'],
                    'email': r['client_email'], 'updatedAt': r['updated_at'],
                    'preview': (r['preview'] or '')[:120], 'unread': r['unread']} for r in rows]})
            return True

        if method == 'GET' and path == '/api/community/messages':
            requested = parse_qs(url.query).get('clientId', [''])[0]
            client_id = requested if staff and requested else uid
            if not staff and requested and requested != uid:
                handler.send_json(403, {'error': 'No puedes leer conversaciones de otros usuarios.'}); return True
            if not _UID.fullmatch(client_id):
                handler.send_json(400, {'error': 'ID de conversación inválido.'}); return True
            if staff:
                thread = db.execute('SELECT 1 FROM nx_support_threads WHERE client_id=?', (client_id,)).fetchone()
                if not thread:
                    handler.send_json(404, {'error': 'La conversación no existe.'}); return True
            rows = db.execute('''SELECT * FROM (SELECT * FROM nx_support_messages
                WHERE client_id=? ORDER BY created_at DESC LIMIT 150) ORDER BY created_at ASC''', (client_id,)).fetchall()
            timestamp = utcnow()
            if staff:
                db.execute('UPDATE nx_support_threads SET staff_seen_at=? WHERE client_id=?', (timestamp, client_id))
            else:
                db.execute('UPDATE nx_support_threads SET client_seen_at=? WHERE client_id=?', (timestamp, uid))
            db.commit()
            handler.send_json(200, {'clientId': client_id, 'messages': [_json_message(r) for r in rows]})
            return True

        if method == 'GET' and path == '/api/community/announcements':
            if not is_admin:
                handler.send_json(403, {'error': 'Solo administradores pueden listar los anuncios.'}); return True
            rows = db.execute('SELECT * FROM nx_announcements ORDER BY published_at DESC LIMIT 50').fetchall()
            handler.send_json(200, {'items': [{'id': r['id'], 'title': r['title'], 'message': r['message'],
                'createdAt': r['published_at']} for r in rows]})
            return True

        if method == 'POST' and path in ('/api/community/roles', '/api/community/announcements',
                                          '/api/community/announcements/read', '/api/community/messages'):
            data = handler.feedback_read_json()
            if data is None:
                return True
            if path == '/api/community/roles':
                if not is_admin:
                    handler.send_json(403, {'error': 'Solo un administrador puede asignar roles.'}); return True
                target = str(data.get('userId') or '')
                new_role = str(data.get('role') or '')
                if not _UID.fullmatch(target) or new_role not in ('cliente', *_ACTIVE_STAFF) or target == uid:
                    handler.send_json(400, {'error': 'Selecciona una cuenta válida y un rol permitido.'}); return True
                # Solo una cuenta registrada puede recibir un rol; el correo viene del servidor.
                auth_header = handler.headers.get('Authorization', '')
                token = auth_header[7:].strip() if auth_header.startswith('Bearer ') else ''
                profile = server.read_firestore_user_profile(target, token)
                if not isinstance(profile, dict) or not profile.get('email'):
                    handler.send_json(404, {'error': 'Selecciona una cuenta existente del panel de usuarios.'}); return True
                if new_role == 'cliente':
                    db.execute('DELETE FROM nx_support_roles WHERE user_id=?', (target,))
                else:
                    db.execute('''INSERT INTO nx_support_roles (user_id,role,email,assigned_at,assigned_by)
                        VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET
                        role=excluded.role,email=excluded.email,assigned_at=excluded.assigned_at,
                        assigned_by=excluded.assigned_by''', (target, new_role, str(profile['email'])[:254], utcnow(), uid))
                db.commit()
                handler.send_json(200, {'ok': True, 'role': new_role}); return True

            if path == '/api/community/announcements':
                if not is_admin:
                    handler.send_json(403, {'error': 'Solo el administrador puede enviar anuncios globales.'}); return True
                title = str(data.get('title') or '').strip()
                message = str(data.get('message') or '').strip()
                if not 2 <= len(title) <= 100 or not 3 <= len(message) <= 1000:
                    handler.send_json(400, {'error': 'Escribe un título (2-100) y un texto (3-1000 caracteres).'}); return True
                item_id = str(uuid.uuid4()); now = utcnow()
                db.execute('INSERT INTO nx_announcements VALUES (?,?,?,?,?)', (item_id, title, message, now, uid))
                db.commit()
                handler.send_json(201, {'ok': True, 'id': item_id}); return True

            if path == '/api/community/announcements/read':
                item_id = str(data.get('id') or '')
                if not _MESSAGE_ID.fullmatch(item_id) or not db.execute('SELECT 1 FROM nx_announcements WHERE id=?', (item_id,)).fetchone():
                    handler.send_json(404, {'error': 'Aviso no encontrado.'}); return True
                db.execute('INSERT OR IGNORE INTO nx_announcement_reads VALUES (?,?,?)', (uid, item_id, utcnow()))
                db.commit()
                handler.send_json(200, {'ok': True}); return True

            client_id = uid if not staff else str(data.get('clientId') or '')
            if not _UID.fullmatch(client_id):
                handler.send_json(400, {'error': 'Selecciona una conversación válida.'}); return True
            message = str(data.get('text') or '').strip()
            if not message or len(message) > 2500:
                handler.send_json(400, {'error': 'El mensaje debe tener entre 1 y 2500 caracteres.'}); return True
            if staff:
                if not db.execute('SELECT 1 FROM nx_support_threads WHERE client_id=?', (client_id,)).fetchone():
                    handler.send_json(404, {'error': 'El cliente todavía no inició esta conversación.'}); return True
            else:
                email = str(identity.get('email') or '')[:254]
                name = str(identity.get('displayName') or identity.get('email') or 'Cliente')[:80]
                now = utcnow()
                db.execute('''INSERT INTO nx_support_threads (client_id,client_name,client_email,created_at,updated_at)
                    VALUES (?,?,?,?,?) ON CONFLICT(client_id) DO UPDATE SET
                    client_name=excluded.client_name,client_email=excluded.client_email''', (uid, name, email, now, now))
            recent = db.execute('''SELECT created_at FROM nx_support_messages
                WHERE author_id=? ORDER BY created_at DESC LIMIT 1''', (uid,)).fetchone()
            # Limita los envíos seguidos sin ralentizar el chat normal.
            if recent:
                from datetime import timedelta
                try:
                    if datetime.fromisoformat(recent['created_at']) > datetime.now(timezone.utc) - timedelta(seconds=1):
                        handler.send_json(429, {'error': 'Espera un instante antes de enviar otro mensaje.'}); return True
                except ValueError:
                    pass
            now = utcnow()
            message_id = str(uuid.uuid4())
            db.execute('''INSERT INTO nx_support_messages
                (id,client_id,author_id,author_role,body,created_at)
                VALUES (?,?,?,?,?,?)''', (message_id, client_id, uid, role if staff else 'cliente', message, now))
            db.execute('UPDATE nx_support_threads SET updated_at=? WHERE client_id=?', (now, client_id))
            db.commit()
            handler.send_json(201, {'ok': True, 'id': message_id}); return True

        if method == 'PATCH' and path.startswith('/api/community/messages/'):
            item_id = path.rsplit('/', 1)[-1]
            if not _MESSAGE_ID.fullmatch(item_id):
                handler.send_json(404, {'error': 'Mensaje no encontrado.'}); return True
            data = handler.feedback_read_json()
            if data is None:
                return True
            message = str(data.get('text') or '').strip()
            if not 1 <= len(message) <= 2500:
                handler.send_json(400, {'error': 'El texto debe tener entre 1 y 2500 caracteres.'}); return True
            record = db.execute('SELECT * FROM nx_support_messages WHERE id=?', (item_id,)).fetchone()
            if not record or record['deleted']:
                handler.send_json(404, {'error': 'El mensaje no existe.'}); return True
            if record['author_id'] != uid:
                handler.send_json(403, {'error': 'Solo puedes editar tus propios mensajes.'}); return True
            db.execute('UPDATE nx_support_messages SET body=?,edited_at=? WHERE id=?', (message, utcnow(), item_id))
            db.commit()
            handler.send_json(200, {'ok': True}); return True

        if method == 'DELETE' and path.startswith('/api/community/messages/'):
            item_id = path.rsplit('/', 1)[-1]
            if not _MESSAGE_ID.fullmatch(item_id):
                handler.send_json(404, {'error': 'Mensaje no encontrado.'}); return True
            record = db.execute('SELECT * FROM nx_support_messages WHERE id=?', (item_id,)).fetchone()
            if not record:
                handler.send_json(404, {'error': 'Mensaje no encontrado.'}); return True
            if record['author_id'] != uid and not is_admin:
                handler.send_json(403, {'error': 'No puedes borrar mensajes de otra persona.'}); return True
            db.execute('UPDATE nx_support_messages SET body=?,deleted=1,edited_at=? WHERE id=?', ('', utcnow(), item_id))
            db.commit()
            handler.send_json(200, {'ok': True}); return True

        if method == 'DELETE' and path.startswith('/api/community/announcements/'):
            if not is_admin:
                handler.send_json(403, {'error': 'Solo administradores pueden retirar anuncios globales.'}); return True
            item_id = path.rsplit('/', 1)[-1]
            if not _MESSAGE_ID.fullmatch(item_id):
                handler.send_json(404, {'error': 'Aviso no encontrado.'}); return True
            cursor = db.execute('DELETE FROM nx_announcements WHERE id=?', (item_id,))
            db.execute('DELETE FROM nx_announcement_reads WHERE announcement_id=?', (item_id,))
            db.commit()
            handler.send_json(200 if cursor.rowcount else 404, {'ok': bool(cursor.rowcount)} if cursor.rowcount else {'error': 'Aviso no encontrado.'})
            return True

    handler.send_json(404, {'error': 'Ruta de comunidad desconocida.'})
    return True
