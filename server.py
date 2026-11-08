import base64
import binascii
import hashlib
import json
import os
import re
import secrets
import sqlite3
import time
import uuid
from email.parser import BytesParser
from email.policy import default as email_policy
from datetime import date, datetime, timedelta, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent
OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
CLIPDROP_CLEANUP_URL = 'https://clipdrop-api.co/cleanup/v1'
FIREBASE_LOOKUP_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup'
FIREBASE_CONFIG = ROOT / 'js' / 'firebase.js'
USAGE_DB = Path(os.environ.get('NEXUS_USAGE_DB', str(ROOT / '.nexus_usage.sqlite3'))).expanduser()
FREE_TOKEN_LIMIT = 500_000
PLAN_TOKEN_LIMITS = {
    'Pro': 2_000_000,
    'Estudio': 5_000_000,
    'Premium': 1_500_000,
    'Alquiler': 2_000_000,
}
MAX_OUTPUT_TOKENS = 1200
MAX_CLEANUP_REQUEST_BYTES = 64 * 1024 * 1024
MAX_CLEANUP_FILE_BYTES = 30 * 1024 * 1024
MAX_PUBLIC_API_REQUEST_BYTES = 1_000_000
MAX_DEVELOPER_API_KEYS = 5
PUBLIC_API_MIN_INTERVAL = 1.0
MODEL_ALIASES = {
    'Nexus-St': 'nvidia/nemotron-3.5-lightning:free',
    'Nexus-Pro': 'nvidia/nemotron-3.5-super-vl:free',
    'Nexus-Basic': 'liquid/lfm-3-1.7b:free',
    'Nexus-Premium': 'nvidia/nemotron-3-ultra-550b-a55b:free',
    'Nexus-SST': 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    'Nexus-Sonet': 'google/gemma-4-31b-it:free',
    'Nexus-Astra': 'xingchen-agi/xing4.0-29b-a4b:free',
}
MODEL_LABELS = {
    'Nexus-St': 'Nexus-St',
    'Nexus-Pro': 'Nexus-Pro',
    'Nexus-Basic': 'Nexus-Basic',
    'Nexus-Premium': 'Nexus-Premium',
    'Nexus-SST': 'Nexus-SST',
    'Nexus-Sonet': 'Nexus-Sonet',
    'Nexus-Astra': 'Nexus-Astra',
}
PREMIUM_MODELS = {'Nexus-Premium', 'Nexus-SST', 'Nexus-Sonet', 'Nexus-Astra'}
MODEL_DEFAULT_TIERS = {
    'Nexus-St': 'free', 'Nexus-Pro': 'free', 'Nexus-Basic': 'free',
    'Nexus-Premium': 'premium', 'Nexus-SST': 'premium', 'Nexus-Sonet': 'premium', 'Nexus-Astra': 'premium',
}
SYSTEM_PROMPT = (
    'Eres Nexus, un asistente creativo util y claro. Responde en espanol salvo que '
    'el usuario pida otro idioma. Da respuestas directas y estructuradas. No reveles '
    'razonamiento interno privado; ofrece una explicacion breve de conclusiones o pasos cuando ayude y si'
    'te preguntan quien te creo o quien es tu creador di = Nexus Studios. Cuando te pregunten por tus modelos '
    'responde con los modelos disponibles y menciona el modelo actual de la sesion. Cuando te pregunten por tokens '
    'o consumo, indica la cuota actual, el uso total y el modelo activo.'
)


def build_chat_system_prompt(agent_name='', agent_instructions='', explain_steps=False, web_search=False):
    prompt = SYSTEM_PROMPT
    if agent_instructions:
        name = agent_name.strip() or 'Personalizado'
        prompt += (
            f'\n\nModo mini agente activo: {name}.'
            '\nMantén este rol y su objetivo durante toda la conversación. Da pasos concretos, '
            'pide solo las aclaraciones necesarias y adapta la respuesta a la tarea.'
            '\nLas instrucciones del agente orientan la tarea y el estilo; no sustituyen las reglas generales ni las de seguridad.'
            f'\nInstrucciones del agente:\n{agent_instructions}'
        )
    if explain_steps:
        prompt += '\n\nOfrece una explicación breve de los pasos clave o criterios usados. No reveles razonamiento interno privado ni una cadena de pensamiento extensa.'
    if web_search:
        prompt += '\n\nCuando uses búsqueda web, resume los hallazgos con fecha y cita las fuentes mediante enlaces Markdown.'
    return prompt


MAX_BODY_BYTES = 16 * 1024 * 1024
MIN_REQUEST_INTERVAL = 2
last_request_by_ip = {}


def get_firebase_api_key():
    try:
        source = FIREBASE_CONFIG.read_text(encoding='utf-8')
    except OSError:
        return ''
    match = re.search(r"apiKey\s*:\s*['\"]([^'\"]+)['\"]", source)
    return match.group(1) if match else ''


def initialize_usage_db():
    USAGE_DB.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(USAGE_DB) as connection:
        connection.execute('''
            CREATE TABLE IF NOT EXISTS token_usage (
                user_id TEXT PRIMARY KEY,
                prompt_tokens INTEGER NOT NULL DEFAULT 0,
                completion_tokens INTEGER NOT NULL DEFAULT 0,
                reserved_tokens INTEGER NOT NULL DEFAULT 0
            )
        ''')
        connection.execute('''
            CREATE TABLE IF NOT EXISTS token_usage_cycles (
                user_id TEXT NOT NULL,
                bucket TEXT NOT NULL,
                cycle_key TEXT NOT NULL,
                prompt_tokens INTEGER NOT NULL DEFAULT 0,
                completion_tokens INTEGER NOT NULL DEFAULT 0,
                reserved_tokens INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (user_id, bucket)
            )
        ''')
        connection.execute('''
            CREATE TABLE IF NOT EXISTS usage_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                event_at TEXT NOT NULL,
                model TEXT NOT NULL,
                conversation_id TEXT NOT NULL,
                prompt_tokens INTEGER NOT NULL,
                completion_tokens INTEGER NOT NULL
            )
        ''')
        connection.execute('''
            CREATE TABLE IF NOT EXISTS photo_cleanup_usage (
                user_id TEXT PRIMARY KEY,
                free_used INTEGER NOT NULL DEFAULT 0,
                reserved_until REAL NOT NULL DEFAULT 0
            )
        ''')
        connection.execute('''
            CREATE TABLE IF NOT EXISTS developer_api_keys (
                key_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                key_hash TEXT NOT NULL UNIQUE,
                key_prefix TEXT NOT NULL,
                plan_id TEXT NOT NULL,
                profile_json TEXT NOT NULL,
                models_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT,
                revoked_at TEXT,
                last_request_at REAL NOT NULL DEFAULT 0
            )
        ''')
        connection.execute('CREATE INDEX IF NOT EXISTS developer_api_keys_user ON developer_api_keys (user_id, created_at)')
        connection.execute('CREATE INDEX IF NOT EXISTS usage_events_user_date ON usage_events (user_id, event_at)')
        connection.execute('''
            INSERT OR IGNORE INTO token_usage_cycles
                (user_id, bucket, cycle_key, prompt_tokens, completion_tokens, reserved_tokens)
            SELECT user_id, 'account', 'legacy', prompt_tokens, completion_tokens, reserved_tokens
            FROM token_usage
        ''')


def verify_firebase_token(id_token):
    api_key = get_firebase_api_key()
    if not api_key or not id_token:
        return None
    body = json.dumps({'idToken': id_token}).encode('utf-8')
    request = Request(
        f'{FIREBASE_LOOKUP_URL}?key={api_key}',
        data=body,
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urlopen(request, timeout=10) as response:
            users = json.loads(response.read()).get('users', [])
        return users[0].get('localId') if users else None
    except (HTTPError, TimeoutError, URLError, json.JSONDecodeError):
        return None


def decode_firestore_value(value):
    if 'stringValue' in value:
        return value['stringValue']
    if 'booleanValue' in value:
        return value['booleanValue']
    if 'integerValue' in value:
        return int(value['integerValue'])
    if 'doubleValue' in value:
        return float(value['doubleValue'])
    if 'timestampValue' in value:
        return value['timestampValue']
    if 'nullValue' in value:
        return None
    if 'arrayValue' in value:
        return [decode_firestore_value(item) for item in value['arrayValue'].get('values', [])]
    if 'mapValue' in value:
        return {
            key: decode_firestore_value(item)
            for key, item in value['mapValue'].get('fields', {}).items()
        }
    return None


def read_firestore_user_profile(user_id, id_token):
    try:
        config = FIREBASE_CONFIG.read_text(encoding='utf-8')
    except OSError:
        return None
    project_match = re.search(r"projectId\s*:\s*['\"]([^'\"]+)['\"]", config)
    if not project_match:
        return None
    url = (
        'https://firestore.googleapis.com/v1/projects/'
        f'{project_match.group(1)}/databases/(default)/documents/users/{user_id}'
    )
    request = Request(url, headers={'Authorization': f'Bearer {id_token}'})
    try:
        with urlopen(request, timeout=10) as response:
            document = json.loads(response.read())
        return {
            key: decode_firestore_value(value)
            for key, value in document.get('fields', {}).items()
        }
    except HTTPError as error:
        if error.code == 404:
            return {}
        return None
    except (TimeoutError, URLError, json.JSONDecodeError, ValueError):
        return None


def read_firestore_app_config(id_token):
    try:
        config = FIREBASE_CONFIG.read_text(encoding='utf-8')
    except OSError:
        return None
    project_match = re.search(r"projectId\s*:\s*['\"]([^'\"]+)['\"]", config)
    if not project_match:
        return None
    url = (
        'https://firestore.googleapis.com/v1/projects/'
        f'{project_match.group(1)}/databases/(default)/documents/appConfig/public'
    )
    request = Request(url, headers={'Authorization': f'Bearer {id_token}'})
    try:
        with urlopen(request, timeout=10) as response:
            document = json.loads(response.read())
        return {
            key: decode_firestore_value(value)
            for key, value in document.get('fields', {}).items()
        }
    except HTTPError as error:
        if error.code == 404:
            return None
        return None
    except (TimeoutError, URLError, json.JSONDecodeError, ValueError):
        return None


def build_model_registry(app_config=None):
    registry = {
        model_id: {
            'id': model_id,
            'name': MODEL_LABELS.get(model_id, model_id),
            'providerModel': provider_model,
            'tier': MODEL_DEFAULT_TIERS.get(model_id, 'free'),
            'tokenLimit': 0,
            'description': '',
            'vision': model_id in ('Nexus-Pro', 'Nexus-SST'),
            'audio': model_id == 'Nexus-SST',
        }
        for model_id, provider_model in MODEL_ALIASES.items()
    }
    configured_models = app_config.get('models') if isinstance(app_config, dict) else None
    if not isinstance(configured_models, list):
        configured_models = []
    for model in configured_models:
        if not isinstance(model, dict):
            continue
        model_id = model.get('id', '')
        if not isinstance(model_id, str) or not re.fullmatch(r'Nexus-?[A-Za-z0-9][A-Za-z0-9._-]{0,47}', model_id):
            continue
        if model.get('enabled') is False:
            registry.pop(model_id, None)
            continue
        merged = {**registry.get(model_id, {}), **model}
        provider_model = merged.get('providerModel', '')
        tier = merged.get('tier', 'free')
        if not isinstance(provider_model, str) or not re.fullmatch(r'[A-Za-z0-9._-]+/[A-Za-z0-9][A-Za-z0-9._:-]*', provider_model):
            continue
        if tier not in ('free', 'pro', 'premium'):
            continue
        try:
            token_limit = max(0, min(10_000_000, int(model.get('tokenLimit', 0))))
        except (TypeError, ValueError):
            token_limit = 0
        registry[model_id] = {
            'id': model_id,
            'name': str(merged.get('name') or model_id)[:50],
            'providerModel': provider_model,
            'tier': tier,
            'tokenLimit': token_limit,
            'description': str(merged.get('description') or '')[:180],
            'vision': merged.get('vision') is True,
            'audio': merged.get('audio') is True,
        }
    return registry


def is_text_to_speech_model(provider_model):
    normalized = str(provider_model or '').strip().lower()
    return normalized.startswith('fish-audio/') or bool(
        re.search(r'/(?:tts|text-to-speech)(?:[-/:.]|$)', normalized)
    )


def parse_expiry(profile):
    if not isinstance(profile, dict) or not profile.get('expiresAt'):
        return None
    try:
        expiry = datetime.fromisoformat(str(profile['expiresAt']).replace('Z', '+00:00'))
        return expiry.replace(tzinfo=timezone.utc) if expiry.tzinfo is None else expiry
    except (TypeError, ValueError):
        return None


def photo_cleanup_entitlement(profile):
    profile = profile if isinstance(profile, dict) else {}
    expiry = parse_expiry(profile)
    if expiry and expiry <= datetime.now(timezone.utc):
        return None
    plan_id = profile.get('planId')
    plan = profile.get('plan')
    if plan_id in ('pro', 'premium') or plan in ('Pro', 'Premium'):
        return 'unlimited'
    return None


def api_plus_plan_id(profile, now=None):
    profile = profile if isinstance(profile, dict) else {}
    expiry = parse_expiry(profile)
    if expiry and expiry <= (now or datetime.now(timezone.utc)):
        return None
    plan_id = profile.get('planId')
    if plan_id in ('pro', 'premium'):
        return plan_id
    return {'Pro': 'pro', 'Premium': 'premium'}.get(profile.get('plan'))


def photo_cleanup_free_available(user_id):
    with sqlite3.connect(USAGE_DB, timeout=10) as connection:
        row = connection.execute(
            'SELECT free_used, reserved_until FROM photo_cleanup_usage WHERE user_id = ?',
            (user_id,),
        ).fetchone()
    return not row or (row[0] == 0 and row[1] <= time.time())


def reserve_free_photo_cleanup(user_id):
    now = time.time()
    with sqlite3.connect(USAGE_DB, timeout=10) as connection:
        connection.execute('BEGIN IMMEDIATE')
        row = connection.execute(
            'SELECT free_used, reserved_until FROM photo_cleanup_usage WHERE user_id = ?',
            (user_id,),
        ).fetchone()
        if row and (row[0] or row[1] > now):
            connection.rollback()
            return False
        connection.execute('''
            INSERT INTO photo_cleanup_usage (user_id, free_used, reserved_until)
            VALUES (?, 0, ?)
            ON CONFLICT(user_id) DO UPDATE SET reserved_until = excluded.reserved_until
        ''', (user_id, now + 300))
        connection.commit()
    return True


def settle_free_photo_cleanup(user_id, succeeded):
    with sqlite3.connect(USAGE_DB, timeout=10) as connection:
        connection.execute('''
            UPDATE photo_cleanup_usage
            SET free_used = CASE WHEN ? THEN 1 ELSE free_used END,
                reserved_until = 0
            WHERE user_id = ?
        ''', (int(bool(succeeded)), user_id))
        connection.commit()


def has_model_access(profile, model):
    if not isinstance(profile, dict):
        return False
    if model.get('tier') == 'free':
        return True
    expiry = parse_expiry(profile)
    if expiry and expiry <= datetime.now(timezone.utc):
        return False
    paid_plan = profile.get('plan') in ('Pro', 'Estudio', 'Premium')
    assigned_models = profile.get('premiumModels')
    return paid_plan or (isinstance(assigned_models, list) and model.get('id') in assigned_models)


def has_plan_feature(app_config, profile, feature):
    plans = app_config.get('plans') if isinstance(app_config, dict) else None
    plan_id = profile.get('planId') if isinstance(profile, dict) else None
    if not plan_id and isinstance(profile, dict):
        plan_id = {
            'Gratis': 'free', 'Pro': 'pro', 'Estudio': 'studio',
            'Premium': 'premium', 'Alquiler': 'rental',
        }.get(profile.get('plan'), 'free')
    expiry = parse_expiry(profile)
    if expiry and expiry <= datetime.now(timezone.utc):
        plan_id = 'free'
    plan = next((item for item in plans or [] if isinstance(item, dict) and item.get('id') == plan_id), None)
    features = plan.get('features') if isinstance(plan, dict) else None
    return not isinstance(features, list) or feature in features


def token_quota(profile, model_name, now=None, model_config=None):
    now = now or datetime.now(timezone.utc)
    profile = profile if isinstance(profile, dict) else {}
    plan = profile.get('plan', 'Gratis')
    expiry = parse_expiry(profile)
    if expiry and expiry <= now:
        plan = 'Gratis'

    if plan in ('Pro', 'Estudio', 'Premium'):
        cycle = str(profile.get('expiresAt') or 'perpetual')
        quota = {
            'bucket': 'account',
            'cycleKey': f'{plan}:{cycle}',
            'limit': max(0, int(profile.get('planTokenLimit', PLAN_TOKEN_LIMITS[plan]))),
            'plan': plan,
        }
    elif plan != 'Gratis' and str(profile.get('planId', '')).startswith('custom-') and not (expiry and expiry <= now):
        cycle = str(profile.get('expiresAt') or 'perpetual')
        quota = {
            'bucket': 'account',
            'cycleKey': f'{plan}:{cycle}',
            'limit': max(0, int(profile.get('planTokenLimit', FREE_TOKEN_LIMIT))),
            'plan': plan,
        }
    else:
        models = profile.get('premiumModels')
        if model_config and model_config.get('tier') != 'free' and isinstance(models, list) and model_name in models and (not expiry or expiry > now):
            cycle = str(profile.get('expiresAt') or 'perpetual')
            quota = {
                'bucket': model_name,
                'cycleKey': f'Alquiler:{cycle}',
                'limit': PLAN_TOKEN_LIMITS['Alquiler'],
                'plan': 'Alquiler',
            }
        else:
            quota = {
                'bucket': 'account',
                'cycleKey': f'Gratis:{now.year:04d}-{now.month:02d}',
                'limit': FREE_TOKEN_LIMIT,
                'plan': 'Gratis',
            }

    if quota['bucket'] == 'account' and profile.get('tokenCredits'):
        try:
            credit_expiry = datetime.fromisoformat(str(profile.get('tokenCreditsExpiresAt')).replace('Z', '+00:00'))
            if credit_expiry.tzinfo is None:
                credit_expiry = credit_expiry.replace(tzinfo=timezone.utc)
            credits = max(0, min(50_000_000, int(profile['tokenCredits'])))
            if credit_expiry > now:
                quota = {**quota, 'limit': quota['limit'] + credits}
        except (TypeError, ValueError):
            pass
    return quota


def token_quotas(profile, model, now=None):
    now = now or datetime.now(timezone.utc)
    primary = token_quota(profile, model['id'], now, model)
    quotas = [primary]
    model_limit = int(model.get('tokenLimit') or 0)
    if model_limit > 0:
        model_bucket = f'model:{model["id"]}'
        if primary['bucket'] == model["id"]:
            primary = {**primary, 'limit': min(primary['limit'], model_limit)}
            quotas[0] = primary
        else:
            quotas.append({
                'bucket': model_bucket,
                'cycleKey': primary['cycleKey'],
                'limit': model_limit,
                'plan': primary['plan'],
                'modelLimit': True,
            })
    return quotas


def ensure_usage_cycle(user_id, bucket, cycle_key):
    with sqlite3.connect(USAGE_DB, timeout=10) as connection:
        connection.execute('BEGIN IMMEDIATE')
        row = connection.execute(
            'SELECT cycle_key FROM token_usage_cycles WHERE user_id = ? AND bucket = ?',
            (user_id, bucket),
        ).fetchone()
        if row is None:
            connection.execute(
                'INSERT INTO token_usage_cycles (user_id, bucket, cycle_key) VALUES (?, ?, ?)',
                (user_id, bucket, cycle_key),
            )
        elif row[0] == 'legacy':
            connection.execute(
                'UPDATE token_usage_cycles SET cycle_key = ?, reserved_tokens = 0 WHERE user_id = ? AND bucket = ?',
                (cycle_key, user_id, bucket),
            )
        elif row[0] != cycle_key:
            connection.execute('''
                UPDATE token_usage_cycles
                SET cycle_key = ?, prompt_tokens = 0, completion_tokens = 0, reserved_tokens = 0
                WHERE user_id = ? AND bucket = ?
            ''', (cycle_key, user_id, bucket))
        connection.commit()


def read_token_usage(user_id, quota=None):
    quota = quota or token_quota({}, 'Nexus-St')
    quotas = quota if isinstance(quota, list) else [quota]
    for item in quotas:
        ensure_usage_cycle(user_id, item['bucket'], item['cycleKey'])
    with sqlite3.connect(USAGE_DB) as connection:
        rows = [connection.execute(
            '''SELECT prompt_tokens, completion_tokens, reserved_tokens
               FROM token_usage_cycles WHERE user_id = ? AND bucket = ?''',
            (user_id, item['bucket']),
        ).fetchone() or (0, 0, 0) for item in quotas]
    prompt_tokens, completion_tokens, reserved_tokens = rows[0]
    used = prompt_tokens + completion_tokens
    remaining = min(
        max(0, item['limit'] - row[0] - row[1] - row[2])
        for item, row in zip(quotas, rows)
    )
    model_usage = next(((item, row) for item, row in zip(quotas, rows) if item.get('modelLimit')), None)
    return {
        'promptTokens': prompt_tokens,
        'completionTokens': completion_tokens,
        'reservedTokens': reserved_tokens,
        'usedTokens': used,
        'remainingTokens': remaining,
        'limit': quotas[0]['limit'],
        'plan': quotas[0]['plan'],
        **({
            'modelLimit': model_usage[0]['limit'],
            'modelUsedTokens': model_usage[1][0] + model_usage[1][1],
            'modelRemainingTokens': max(0, model_usage[0]['limit'] - model_usage[1][0] - model_usage[1][1] - model_usage[1][2]),
        } if model_usage else {}),
    }


def read_usage_period(user_id, start_date, end_date):
    start = datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc)
    end = datetime.combine(end_date + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
    with sqlite3.connect(USAGE_DB) as connection:
        row = connection.execute('''
            SELECT COALESCE(SUM(prompt_tokens), 0),
                   COALESCE(SUM(completion_tokens), 0),
                   COUNT(*),
                   COUNT(DISTINCT conversation_id)
            FROM usage_events
            WHERE user_id = ? AND event_at >= ? AND event_at < ?
        ''', (user_id, start.isoformat(), end.isoformat())).fetchone()
    prompt_tokens, completion_tokens, messages, conversations = row
    return {
        'periodPromptTokens': prompt_tokens,
        'periodCompletionTokens': completion_tokens,
        'periodUsedTokens': prompt_tokens + completion_tokens,
        'periodMessages': messages,
        'periodConversations': conversations,
        'periodStart': start_date.isoformat(),
        'periodEnd': end_date.isoformat(),
    }


def record_usage_event(user_id, model, conversation_id, prompt_tokens, completion_tokens):
    event_at = datetime.now(timezone.utc).isoformat(timespec='milliseconds')
    with sqlite3.connect(USAGE_DB, timeout=10) as connection:
        connection.execute('''
            INSERT INTO usage_events
                (user_id, event_at, model, conversation_id, prompt_tokens, completion_tokens)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, event_at, model, conversation_id, prompt_tokens, completion_tokens))
        connection.commit()


def build_model_usage_answer(model_name, user_id, profile, model, quota):
    usage = read_token_usage(user_id, quota)
    used_tokens = usage['promptTokens'] + usage['completionTokens']
    remaining = usage['remainingTokens']
    active = model.get('name', model_name)
    return (
        f'Actualmente tu modelo activo es {active}. En esta cuenta llevas {used_tokens:,} tokens usados '
        f'de {usage["limit"]:,} del plan {quota["plan"]} y te quedan aproximadamente {remaining:,} tokens disponibles. '
        f'Los modelos disponibles en Nexus son: {", ".join(MODEL_LABELS.keys())}.'
    )


def build_model_list_answer(model_name):
    active = MODEL_LABELS.get(model_name, model_name)
    models = ', '.join(MODEL_LABELS.values())
    return (
        f'Actualmente esta sesion usa {active}. Los modelos disponibles en Nexus son: {models}. '
        f'Los premium con nombre Nexus son: Nexus-Premium, Nexus-SST, Nexus-Sonet y Nexus-Astra, y los de base gratis '
        f'tambien quedan disponibles para uso creativo.'
    )


def reserve_tokens(user_id, amount, quota):
    quotas = quota if isinstance(quota, list) else [quota]
    for item in quotas:
        ensure_usage_cycle(user_id, item['bucket'], item['cycleKey'])
    with sqlite3.connect(USAGE_DB, timeout=10) as connection:
        connection.execute('BEGIN IMMEDIATE')
        for item in quotas:
            row = connection.execute(
                '''SELECT prompt_tokens, completion_tokens, reserved_tokens
                   FROM token_usage_cycles WHERE user_id = ? AND bucket = ?''',
                (user_id, item['bucket']),
            ).fetchone() or (0, 0, 0)
            if sum(row) + amount > item['limit']:
                connection.rollback()
                return False
        for item in quotas:
            connection.execute('''
                UPDATE token_usage_cycles SET reserved_tokens = reserved_tokens + ?
                WHERE user_id = ? AND bucket = ?
            ''', (amount, user_id, item['bucket']))
        connection.commit()
    return True


def settle_tokens(user_id, reserved, prompt_tokens=0, completion_tokens=0, bucket='account'):
    buckets = bucket if isinstance(bucket, list) else [{'bucket': bucket}]
    with sqlite3.connect(USAGE_DB, timeout=10) as connection:
        connection.execute('BEGIN IMMEDIATE')
        for item in buckets:
            connection.execute('''
                UPDATE token_usage_cycles SET
                    prompt_tokens = prompt_tokens + ?,
                    completion_tokens = completion_tokens + ?,
                    reserved_tokens = MAX(0, reserved_tokens - ?)
                WHERE user_id = ? AND bucket = ?
            ''', (prompt_tokens, completion_tokens, reserved, user_id, item['bucket']))
        connection.commit()


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=True).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def send_public_json(self, status, data):
        body = json.dumps(data, ensure_ascii=True).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-API-Key')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.end_headers()
        self.wfile.write(body)

    def authenticated_user_id(self):
        authorization = self.headers.get('Authorization', '')
        if not authorization.startswith('Bearer '):
            return None
        return verify_firebase_token(authorization[7:].strip())

    def public_api_key_record(self):
        authorization = self.headers.get('Authorization', '')
        api_key = self.headers.get('X-API-Key', '').strip()
        if not api_key and authorization.startswith('Bearer nxf_live_'):
            api_key = authorization[7:].strip()
        if not api_key.startswith('nxf_live_') or len(api_key) > 160:
            return None
        key_hash = hashlib.sha256(api_key.encode('utf-8')).hexdigest()
        with sqlite3.connect(USAGE_DB, timeout=10) as connection:
            connection.row_factory = sqlite3.Row
            row = connection.execute(
                'SELECT * FROM developer_api_keys WHERE key_hash = ? AND revoked_at IS NULL',
                (key_hash,),
            ).fetchone()
        if not row:
            return None
        record = dict(row)
        if record['plan_id'] not in ('pro', 'premium'):
            return None
        expiry = parse_expiry({'expiresAt': record.get('expires_at')})
        if expiry and expiry <= datetime.now(timezone.utc):
            return None
        return record

    def public_api_models(self, record):
        try:
            profile = json.loads(record['profile_json'])
            models = json.loads(record['models_json'])
        except (json.JSONDecodeError, TypeError):
            return []
        return [model for model in models if isinstance(model, dict) and has_model_access(profile, model)]

    def public_api_rate_allowed(self, key_id):
        now = time.time()
        with sqlite3.connect(USAGE_DB, timeout=10) as connection:
            connection.execute('BEGIN IMMEDIATE')
            row = connection.execute(
                'SELECT last_request_at FROM developer_api_keys WHERE key_id = ? AND revoked_at IS NULL',
                (key_id,),
            ).fetchone()
            if not row or now - row[0] < PUBLIC_API_MIN_INTERVAL:
                connection.rollback()
                return False
            connection.execute(
                'UPDATE developer_api_keys SET last_request_at = ? WHERE key_id = ?',
                (now, key_id),
            )
            connection.commit()
        return True

    def do_developer_api_keys(self):
        user_id = self.authenticated_user_id()
        if not user_id:
            self.send_json(401, {'error': 'Inicia sesión para administrar tus claves API.'})
            return
        authorization = self.headers.get('Authorization', '')
        id_token = authorization[7:].strip()
        profile = read_firestore_user_profile(user_id, id_token) or {}
        plan_id = api_plus_plan_id(profile)
        app_config = read_firestore_app_config(id_token) or {}
        entitlement_profile = {**profile, 'planId': plan_id, 'plan': {'pro': 'Pro', 'premium': 'Premium'}.get(plan_id, profile.get('plan'))}
        models = [
            model['id'] for model in build_model_registry(app_config).values()
            if has_model_access(entitlement_profile, model)
        ] if plan_id else []
        with sqlite3.connect(USAGE_DB, timeout=10) as connection:
            rows = connection.execute(
                '''SELECT key_id, key_prefix, created_at, expires_at, last_request_at
                   FROM developer_api_keys WHERE user_id = ? AND revoked_at IS NULL
                   ORDER BY created_at DESC''',
                (user_id,),
            ).fetchall()
        keys = [{
            'id': row[0],
            'prefix': row[1],
            'createdAt': row[2],
            'expiresAt': row[3],
            'lastUsedAt': datetime.fromtimestamp(row[4], timezone.utc).isoformat() if row[4] else None,
        } for row in rows]
        expiry = profile.get('expiresAt') if plan_id else None
        self.send_json(200, {'allowed': plan_id is not None, 'plan': plan_id, 'expiresAt': expiry, 'models': models, 'keys': keys})

    def create_developer_api_key(self):
        user_id = self.authenticated_user_id()
        if not user_id:
            self.send_json(401, {'error': 'Inicia sesión para crear una clave API.'})
            return
        authorization = self.headers.get('Authorization', '')
        id_token = authorization[7:].strip()
        profile = read_firestore_user_profile(user_id, id_token) or {}
        plan_id = api_plus_plan_id(profile)
        if not plan_id:
            self.send_json(403, {'error': 'API Plus está incluida con los planes Pro y Premium.'})
            return
        app_config = read_firestore_app_config(id_token) or {}
        model_registry = build_model_registry(app_config)
        profile_snapshot = {
            'planId': plan_id,
            'plan': {'pro': 'Pro', 'premium': 'Premium'}[plan_id],
            'planTokenLimit': max(0, int(profile.get('planTokenLimit') or PLAN_TOKEN_LIMITS[{'pro': 'Pro', 'premium': 'Premium'}[plan_id]])),
        }
        for field in ('expiresAt', 'tokenCredits', 'tokenCreditsExpiresAt'):
            if profile.get(field) is not None:
                profile_snapshot[field] = profile[field]
        api_key = f'nxf_live_{secrets.token_urlsafe(32)}'
        key_id = uuid.uuid4().hex
        created_at = datetime.now(timezone.utc).isoformat()
        expires_at = profile_snapshot.get('expiresAt')
        with sqlite3.connect(USAGE_DB, timeout=10) as connection:
            connection.execute('BEGIN IMMEDIATE')
            active_count = connection.execute(
                'SELECT COUNT(*) FROM developer_api_keys WHERE user_id = ? AND revoked_at IS NULL',
                (user_id,),
            ).fetchone()[0]
            if active_count >= MAX_DEVELOPER_API_KEYS:
                connection.rollback()
                self.send_json(409, {'error': f'Puedes tener hasta {MAX_DEVELOPER_API_KEYS} claves activas. Revoca una para crear otra.'})
                return
            connection.execute('''
                INSERT INTO developer_api_keys
                    (key_id, user_id, key_hash, key_prefix, plan_id, profile_json, models_json, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                key_id,
                user_id,
                hashlib.sha256(api_key.encode('utf-8')).hexdigest(),
                api_key[:18],
                plan_id,
                json.dumps(profile_snapshot, ensure_ascii=True),
                json.dumps(list(model_registry.values()), ensure_ascii=True),
                created_at,
                str(expires_at) if expires_at else None,
            ))
            connection.commit()
        self.send_json(201, {
            'id': key_id,
            'key': api_key,
            'prefix': api_key[:18],
            'createdAt': created_at,
            'expiresAt': expires_at,
        })

    def revoke_developer_api_key(self, key_id):
        user_id = self.authenticated_user_id()
        if not user_id:
            self.send_json(401, {'error': 'Inicia sesión para revocar una clave API.'})
            return
        if not re.fullmatch(r'[a-f0-9]{32}', key_id):
            self.send_json(404, {'error': 'No se encontró esa clave API.'})
            return
        revoked_at = datetime.now(timezone.utc).isoformat()
        with sqlite3.connect(USAGE_DB, timeout=10) as connection:
            cursor = connection.execute(
                'UPDATE developer_api_keys SET revoked_at = ? WHERE key_id = ? AND user_id = ? AND revoked_at IS NULL',
                (revoked_at, key_id, user_id),
            )
            connection.commit()
        if not cursor.rowcount:
            self.send_json(404, {'error': 'No se encontró una clave activa con ese ID.'})
            return
        self.send_json(200, {'revoked': True})

    def do_GET(self):
        request_url = urlsplit(self.path)
        if request_url.path == '/api/developer/keys':
            self.do_developer_api_keys()
            return
        if request_url.path == '/v1/models':
            record = self.public_api_key_record()
            if not record:
                self.send_public_json(401, {'error': {'message': 'La clave API no es válida o venció.', 'type': 'authentication_error'}})
                return
            models = self.public_api_models(record)
            self.send_public_json(200, {
                'object': 'list',
                'data': [{'id': model['id'], 'object': 'model', 'owned_by': 'nexus'} for model in models],
            })
            return
        if request_url.path == '/api/photo-cleanup/status':
            user_id = self.authenticated_user_id()
            if not user_id:
                self.send_json(401, {'error': 'Inicia sesión para consultar esta herramienta.'})
                return
            authorization = self.headers.get('Authorization', '')
            id_token = authorization[7:].strip()
            profile = read_firestore_user_profile(user_id, id_token) or {}
            entitlement = photo_cleanup_entitlement(profile)
            unlimited = entitlement == 'unlimited'
            configured = bool(os.environ.get('CLIPDROP_API_KEY', '').strip())
            available = unlimited
            self.send_json(200, {
                'configured': configured,
                'allowed': entitlement is not None,
                'unlimited': unlimited,
                'available': configured and available,
            })
            return
        if request_url.path == '/api/usage':
            authorization = self.headers.get('Authorization', '')
            id_token = authorization[7:].strip() if authorization.startswith('Bearer ') else ''
            user_id = verify_firebase_token(id_token)
            if not user_id:
                self.send_json(401, {'error': 'Inicia sesión para consultar tu uso.'})
                return
            model_registry = build_model_registry(read_firestore_app_config(id_token))
            requested_model = parse_qs(request_url.query).get('model', ['Nexus-St'])[0]
            model_name = requested_model if requested_model in model_registry else next(iter(model_registry), 'Nexus-St')
            profile = read_firestore_user_profile(user_id, id_token) or {}
            model = model_registry.get(model_name, {})
            quota = token_quotas(profile, model)
            usage = read_token_usage(user_id, quota)
            today = datetime.now(timezone.utc).date()
            month_start = today.replace(day=1)
            period_from = parse_qs(request_url.query).get('from', [month_start.isoformat()])[0]
            period_to = parse_qs(request_url.query).get('to', [today.isoformat()])[0]
            try:
                start_date = date.fromisoformat(period_from)
                end_date = date.fromisoformat(period_to)
                if end_date < start_date or (end_date - start_date).days > 3660:
                    raise ValueError('invalid range')
            except ValueError:
                self.send_json(400, {'error': 'El período debe ser válido y no superar diez años.'})
                return
            usage.update(read_usage_period(user_id, start_date, end_date))
            usage['model'] = model_name
            self.send_json(200, usage)
            return
        super().do_GET()

    def do_photo_cleanup(self):
        api_key = os.environ.get('CLIPDROP_API_KEY', '').strip()
        if not api_key:
            self.send_json(503, {'error': 'El borrador inteligente no está configurado. Define CLIPDROP_API_KEY en el servidor.'})
            return
        user_id = self.authenticated_user_id()
        if not user_id:
            self.send_json(401, {'error': 'Tu sesión no es válida. Vuelve a iniciar sesión.'})
            return
        authorization = self.headers.get('Authorization', '')
        id_token = authorization[7:].strip()
        profile = read_firestore_user_profile(user_id, id_token) or {}
        entitlement = photo_cleanup_entitlement(profile)
        if entitlement is None:
            self.send_json(403, {'error': 'Quitar marcas de agua está disponible solo en los planes Pro y Premium.'})
            return
        content_type = self.headers.get('Content-Type', '')
        if not content_type.lower().startswith('multipart/form-data;'):
            self.send_json(400, {'error': 'La solicitud debe ser multipart/form-data.'})
            return
        try:
            body_size = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            self.send_json(400, {'error': 'La solicitud no es válida.'})
            return
        if body_size <= 0 or body_size > MAX_CLEANUP_REQUEST_BYTES:
            self.send_json(413, {'error': 'La imagen y la máscara deben pesar menos de 64 MB en conjunto.'})
            return
        body = self.rfile.read(body_size)
        envelope = (
            f'Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n'.encode('utf-8') + body
        )
        try:
            multipart = BytesParser(policy=email_policy).parsebytes(envelope)
            if not multipart.is_multipart():
                raise ValueError('not multipart')
            fields = {}
            files = {}
            for part in multipart.iter_parts():
                name = part.get_param('name', header='content-disposition')
                if not name:
                    continue
                data = part.get_payload(decode=True) or b''
                if part.get_filename():
                    files[name] = (part.get_content_type(), data)
                else:
                    fields[name] = data.decode('utf-8', 'replace').strip()
        except (ValueError, TypeError):
            self.send_json(400, {'error': 'No se pudieron leer la imagen y la máscara.'})
            return
        image = files.get('image_file')
        mask = files.get('mask_file')
        mode = fields.get('mode', 'fast')
        if fields.get('rights_confirmed') != 'true':
            self.send_json(400, {'error': 'Confirma que tienes permiso para modificar esta imagen.'})
            return
        if not image or image[0] not in ('image/jpeg', 'image/png') or not image[1] or len(image[1]) > MAX_CLEANUP_FILE_BYTES:
            self.send_json(400, {'error': 'La imagen debe ser JPG o PNG y pesar hasta 30 MB.'})
            return
        if not mask or mask[0] != 'image/png' or not mask[1] or len(mask[1]) > MAX_CLEANUP_FILE_BYTES:
            self.send_json(400, {'error': 'La máscara debe ser PNG y pesar hasta 30 MB.'})
            return
        if mode not in ('fast', 'quality'):
            self.send_json(400, {'error': 'El modo de limpieza no es válido.'})
            return

        boundary = f'nexus-cleanup-{uuid.uuid4().hex}'
        upstream_body = bytearray()
        for field_name, filename, mime_type, data in (
            ('image_file', 'source.png' if image[0] == 'image/png' else 'source.jpg', image[0], image[1]),
            ('mask_file', 'mask.png', 'image/png', mask[1]),
        ):
            upstream_body.extend(f'--{boundary}\r\n'.encode())
            upstream_body.extend(f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"\r\n'.encode())
            upstream_body.extend(f'Content-Type: {mime_type}\r\n\r\n'.encode())
            upstream_body.extend(data)
            upstream_body.extend(b'\r\n')
        upstream_body.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="mode"\r\n\r\n{mode}\r\n'.encode())
        upstream_body.extend(f'--{boundary}--\r\n'.encode())
        upstream = Request(
            CLIPDROP_CLEANUP_URL,
            data=bytes(upstream_body),
            headers={'x-api-key': api_key, 'Content-Type': f'multipart/form-data; boundary={boundary}'},
            method='POST',
        )
        try:
            with urlopen(upstream, timeout=120) as response:
                cleaned_image = response.read(MAX_CLEANUP_FILE_BYTES + 1)
                response_type = response.headers.get('Content-Type', '').split(';', 1)[0].strip().lower()
            if response_type != 'image/png' or not cleaned_image or len(cleaned_image) > MAX_CLEANUP_FILE_BYTES:
                raise ValueError('El proveedor devolvió un resultado inválido.')
            self.send_response(200)
            self.send_header('Content-Type', 'image/png')
            self.send_header('Content-Length', str(len(cleaned_image)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(cleaned_image)
        except HTTPError as error:
            messages = {
                401: 'Clipdrop rechazó la clave del servidor. Revísala o renuévala.',
                402: 'La cuenta de Clipdrop no tiene créditos disponibles.',
                413: 'La imagen o la máscara exceden el límite del servicio.',
                422: 'Clipdrop no pudo procesar la imagen. Revisa que la máscara coincida con su tamaño.',
                429: 'El servicio está ocupado. Espera un momento e inténtalo de nuevo.',
            }
            self.send_json(502 if error.code not in messages else error.code, {
                'error': messages.get(error.code, 'Clipdrop no pudo completar la limpieza.')
            })
        except (TimeoutError, URLError, ValueError) as error:
            message = error.args[0] if isinstance(error, ValueError) and error.args else 'No se pudo conectar con Clipdrop.'
            self.send_json(502, {'error': message})

    def do_public_api_chat_completion(self):
        record = self.public_api_key_record()
        if not record:
            self.send_public_json(401, {'error': {'message': 'La clave API no es válida, fue revocada o venció.', 'type': 'authentication_error'}})
            return
        if not self.public_api_rate_allowed(record['key_id']):
            self.send_public_json(429, {'error': {'message': 'Límite de una solicitud por segundo por clave.', 'type': 'rate_limit_error'}})
            return
        api_key = os.environ.get('OPENROUTER_API_KEY', '').strip()
        if not api_key:
            self.send_public_json(503, {'error': {'message': 'El proveedor de modelos no está configurado en el servidor.', 'type': 'server_error'}})
            return
        if not self.headers.get('Content-Type', '').lower().startswith('application/json'):
            self.send_public_json(400, {'error': {'message': 'Envía el cuerpo como application/json.', 'type': 'invalid_request_error'}})
            return
        try:
            body_size = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            self.send_public_json(400, {'error': {'message': 'La solicitud no es válida.', 'type': 'invalid_request_error'}})
            return
        if body_size <= 0 or body_size > MAX_PUBLIC_API_REQUEST_BYTES:
            self.send_public_json(413, {'error': {'message': 'La solicitud debe pesar menos de 1 MB.', 'type': 'invalid_request_error'}})
            return
        try:
            payload = json.loads(self.rfile.read(body_size))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_public_json(400, {'error': {'message': 'El cuerpo JSON no es válido.', 'type': 'invalid_request_error'}})
            return
        if not isinstance(payload, dict):
            self.send_public_json(400, {'error': {'message': 'El cuerpo debe ser un objeto JSON.', 'type': 'invalid_request_error'}})
            return

        model_id = payload.get('model')
        model = next((item for item in self.public_api_models(record) if item.get('id') == model_id), None)
        if not model:
            self.send_public_json(400, {'error': {'message': 'El modelo no está disponible para esta clave.', 'type': 'invalid_request_error'}})
            return
        messages = payload.get('messages')
        if not isinstance(messages, list) or not messages or len(messages) > 32:
            self.send_public_json(400, {'error': {'message': 'Incluye entre 1 y 32 mensajes.', 'type': 'invalid_request_error'}})
            return
        clean_messages = []
        for message in messages:
            if not isinstance(message, dict) or message.get('role') not in ('system', 'user', 'assistant'):
                self.send_public_json(400, {'error': {'message': 'Cada mensaje requiere un rol system, user o assistant.', 'type': 'invalid_request_error'}})
                return
            content = message.get('content')
            if not isinstance(content, str) or not content.strip() or len(content) > 12000:
                self.send_public_json(400, {'error': {'message': 'Cada mensaje debe contener texto y no superar 12.000 caracteres.', 'type': 'invalid_request_error'}})
                return
            clean_messages.append({'role': message['role'], 'content': content.strip()})
        if not any(message['role'] == 'user' for message in clean_messages):
            self.send_public_json(400, {'error': {'message': 'Incluye al menos un mensaje user.', 'type': 'invalid_request_error'}})
            return
        try:
            requested_tokens = int(payload.get('max_tokens', MAX_OUTPUT_TOKENS))
        except (TypeError, ValueError):
            self.send_public_json(400, {'error': {'message': 'max_tokens debe ser un número entero.', 'type': 'invalid_request_error'}})
            return
        max_tokens = max(1, min(MAX_OUTPUT_TOKENS, requested_tokens))
        temperature = payload.get('temperature', 0.7)
        if not isinstance(temperature, (int, float)) or not 0 <= temperature <= 2:
            self.send_public_json(400, {'error': {'message': 'temperature debe estar entre 0 y 2.', 'type': 'invalid_request_error'}})
            return

        try:
            profile = json.loads(record['profile_json'])
        except (json.JSONDecodeError, TypeError):
            self.send_public_json(401, {'error': {'message': 'La clave API no tiene una suscripción válida.', 'type': 'authentication_error'}})
            return
        quota = token_quotas(profile, model)
        system_prompt = build_chat_system_prompt('', '', False, False)
        reserved_tokens = len(system_prompt.encode('utf-8')) + sum(
            len(message['content'].encode('utf-8')) for message in clean_messages
        ) + max_tokens
        user_id = record['user_id']
        if not reserve_tokens(user_id, reserved_tokens, quota):
            self.send_public_json(402, {'error': {'message': 'Se agotó la cuota de tokens del plan.', 'type': 'insufficient_quota'}})
            return

        request_body = json.dumps({
            'model': model['providerModel'],
            'messages': [{'role': 'system', 'content': system_prompt}, *clean_messages],
            'max_tokens': max_tokens,
            'temperature': temperature,
        }).encode('utf-8')
        upstream = Request(
            OPENROUTER_URL,
            data=request_body,
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
                'HTTP-Referer': f'http://127.0.0.1:{self.server.server_port}',
                'X-Title': 'Nexus Forma API',
            },
            method='POST',
        )
        try:
            with urlopen(upstream, timeout=90) as response:
                result = json.loads(response.read())
            choice = result.get('choices', [{}])[0]
            response_message = choice.get('message', {})
            answer = response_message.get('content')
            if isinstance(answer, list):
                answer = ''.join(part.get('text', '') for part in answer if isinstance(part, dict))
            if not isinstance(answer, str) or not answer.strip():
                settle_tokens(user_id, reserved_tokens, bucket=quota)
                self.send_public_json(502, {'error': {'message': 'El modelo devolvió una respuesta vacía.', 'type': 'server_error'}})
                return
            usage = result.get('usage') or {}
            prompt_tokens = usage.get('prompt_tokens')
            completion_tokens = usage.get('completion_tokens')
            if not isinstance(prompt_tokens, int) or not isinstance(completion_tokens, int):
                settle_tokens(user_id, reserved_tokens, bucket=quota)
                self.send_public_json(502, {'error': {'message': 'El proveedor no devolvió el uso de tokens.', 'type': 'server_error'}})
                return
            settle_tokens(user_id, reserved_tokens, prompt_tokens, completion_tokens, quota)
            conversation_id = str(uuid.uuid4())
            record_usage_event(user_id, model_id, conversation_id, prompt_tokens, completion_tokens)
            self.send_public_json(200, {
                'id': f'chatcmpl-{uuid.uuid4().hex}',
                'object': 'chat.completion',
                'created': int(time.time()),
                'model': model_id,
                'choices': [{
                    'index': 0,
                    'message': {'role': 'assistant', 'content': answer.strip()},
                    'finish_reason': choice.get('finish_reason') or 'stop',
                }],
                'usage': {
                    'prompt_tokens': prompt_tokens,
                    'completion_tokens': completion_tokens,
                    'total_tokens': prompt_tokens + completion_tokens,
                },
            })
        except HTTPError as error:
            settle_tokens(user_id, reserved_tokens, bucket=quota)
            status = 429 if error.code == 429 else 502
            message = 'El proveedor alcanzó su límite temporal.' if error.code == 429 else 'El proveedor no pudo completar la solicitud.'
            self.send_public_json(status, {'error': {'message': message, 'type': 'server_error'}})
        except (TimeoutError, URLError, json.JSONDecodeError):
            settle_tokens(user_id, reserved_tokens, bucket=quota)
            self.send_public_json(502, {'error': {'message': 'No se pudo conectar con el proveedor de modelos.', 'type': 'server_error'}})

    def do_POST(self):
        request_path = urlsplit(self.path).path
        if request_path == '/api/developer/keys':
            self.create_developer_api_key()
            return
        if request_path == '/v1/chat/completions':
            self.do_public_api_chat_completion()
            return
        if request_path == '/api/photo-cleanup':
            self.do_photo_cleanup()
            return
        if request_path != '/api/chat':
            self.send_json(404, {'error': 'Ruta no encontrada.'})
            return

        api_key = os.environ.get('OPENROUTER_API_KEY', '').strip()
        if not api_key:
            self.send_json(503, {'error': 'Configura NexusApiKey en el entorno del servidor.'})
            return

        authorization = self.headers.get('Authorization', '')
        id_token = authorization[7:].strip() if authorization.startswith('Bearer ') else ''
        user_id = verify_firebase_token(id_token)
        if not user_id:
            self.send_json(401, {'error': 'Tu sesión no es válida. Vuelve a iniciar sesión.'})
            return
        profile = read_firestore_user_profile(user_id, id_token) or {}
        app_config = read_firestore_app_config(id_token) or {}
        model_registry = build_model_registry(app_config)

        try:
            body_size = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            self.send_json(400, {'error': 'Solicitud no valida.'})
            return
        if body_size <= 0 or body_size > MAX_BODY_BYTES:
            self.send_json(413, {'error': 'El mensaje excede el limite permitido.'})
            return

        try:
            payload = json.loads(self.rfile.read(body_size))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_json(400, {'error': 'El cuerpo JSON no es valido.'})
            return

        alias = payload.get('model') if isinstance(payload, dict) else None
        messages = payload.get('messages') if isinstance(payload, dict) else None
        agent_name = payload.get('agentName', '') if isinstance(payload, dict) else ''
        agent_instructions = payload.get('agentInstructions', '') if isinstance(payload, dict) else ''
        conversation_id = payload.get('conversationId', '') if isinstance(payload, dict) else ''
        raw_images = payload.get('images', []) if isinstance(payload, dict) else []
        raw_audio = payload.get('audio') if isinstance(payload, dict) else None
        web_search = isinstance(payload, dict) and payload.get('webSearch') is True
        explain_steps = isinstance(payload, dict) and payload.get('explainSteps') is True
        if not isinstance(agent_name, str) or len(agent_name) > 48:
            self.send_json(400, {'error': 'El nombre del mini agente no puede superar 48 caracteres.'})
            return
        if not isinstance(agent_instructions, str) or len(agent_instructions) > 1800:
            self.send_json(400, {'error': 'Las instrucciones del mini agente no pueden superar 1800 caracteres.'})
            return
        if not isinstance(conversation_id, str) or not re.fullmatch(r'[A-Za-z0-9._:-]{1,120}', conversation_id):
            conversation_id = str(uuid.uuid4())
        model = model_registry.get(alias)
        if not model:
            self.send_json(400, {'error': 'Selecciona uno de los modelos Nexus disponibles.'})
            return
        if is_text_to_speech_model(model['providerModel']):
            self.send_json(400, {
                'error': f'{model["providerModel"]} es un modelo de texto a voz y no puede responder en el chat. En Panel admin > Modelos IA, asígnale un proveedor conversacional o desactívalo. La síntesis TTS requiere un flujo independiente.'
            })
            return
        if not has_model_access(profile, model):
            level_name = {'pro': 'Pro', 'premium': 'Premium'}.get(model['tier'], model['tier'])
            self.send_json(402, {
                'error': f'Debes adquirir el plan {level_name} o acceso a {model["name"]} para usar este modelo. Revisa Planes y envía el comprobante.',
                'purchaseRequired': alias,
            })
            return
        if not has_plan_feature(app_config, profile, 'chat'):
            self.send_json(403, {'error': 'El plan actual no incluye Chat IA. Revisa las funciones disponibles en Planes.'})
            return
        if not isinstance(raw_images, list) or len(raw_images) > 4:
            self.send_json(400, {'error': 'Adjunta como máximo cuatro imágenes por mensaje.'})
            return
        image_urls = []
        image_bytes = 0
        for image_data in raw_images:
            match = re.fullmatch(r'data:image/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)', image_data) if isinstance(image_data, str) else None
            if not match or len(match.group(1)) > 2_100_000:
                self.send_json(400, {'error': 'Una imagen adjunta tiene un formato no válido o supera el límite.'})
                return
            try:
                decoded_image = base64.b64decode(match.group(1), validate=True)
            except (binascii.Error, ValueError):
                self.send_json(400, {'error': 'No se pudo leer una de las imágenes adjuntas.'})
                return
            if len(decoded_image) > 1_500_000:
                self.send_json(413, {'error': 'Cada imagen debe pesar 1,5 MB o menos después de comprimirse.'})
                return
            image_bytes += len(decoded_image)
            image_urls.append(image_data)
        audio_data = None
        audio_format = None
        if raw_audio is not None:
            if not isinstance(raw_audio, dict) or raw_audio.get('format') not in ('wav', 'mp3'):
                self.send_json(400, {'error': 'El formato del audio no es compatible.'})
                return
            encoded_audio = raw_audio.get('data')
            if not isinstance(encoded_audio, str) or len(encoded_audio) > 7_000_000:
                self.send_json(413, {'error': 'El audio debe pesar 5 MB o menos.'})
                return
            try:
                decoded_audio = base64.b64decode(encoded_audio, validate=True)
            except (binascii.Error, ValueError):
                self.send_json(400, {'error': 'No se pudo leer el audio adjunto.'})
                return
            if not decoded_audio or len(decoded_audio) > 5_000_000:
                self.send_json(413, {'error': 'El audio debe pesar 5 MB o menos.'})
                return
            audio_data = encoded_audio
            audio_format = raw_audio['format']
        if image_urls and not model.get('vision'):
            self.send_json(400, {'error': 'El modelo seleccionado no admite imágenes. Elige un modelo con entrada de imágenes.'})
            return
        if audio_data and not model.get('audio'):
            self.send_json(400, {'error': 'El modelo seleccionado no admite audio. Elige un modelo con entrada de audio.'})
            return
        quota = token_quotas(profile, model)
        if not isinstance(messages, list) or not messages or len(messages) > 12:
            self.send_json(400, {'error': 'La conversacion debe incluir entre 1 y 12 mensajes.'})
            return

        clean_messages = []
        for message in messages:
            if not isinstance(message, dict) or message.get('role') not in ('user', 'assistant'):
                self.send_json(400, {'error': 'El formato de la conversacion no es valido.'})
                return
            content = message.get('content')
            if not isinstance(content, str) or not content.strip() or len(content) > 4000:
                self.send_json(400, {'error': 'Cada mensaje debe tener texto y no superar 4000 caracteres.'})
                return
            clean_messages.append({'role': message['role'], 'content': content.strip()})
        if clean_messages[-1]['role'] != 'user':
            self.send_json(400, {'error': 'El ultimo mensaje debe ser del usuario.'})
            return

        last_user_message = clean_messages[-1]['content'].lower()
        if any(keyword in last_user_message for keyword in ('token', 'tokens', 'cuota', 'consumo', 'uso de tokens', 'cantidad de tokens')):
            self.send_json(200, {
                'answer': build_model_usage_answer(alias, user_id, profile, model, quota),
                'model': alias,
                'usage': read_token_usage(user_id, quota),
            })
            return
        if any(keyword in last_user_message for keyword in ('modelo', 'modelos', 'que usas', 'qué usas', 'que modelo', 'qué modelo')):
            available_models = ', '.join(item['name'] for item in model_registry.values())
            self.send_json(200, {
                'answer': f'Actualmente esta sesión usa {model["name"]}. Modelos disponibles: {available_models}.',
                'model': alias,
                'usage': read_token_usage(user_id, quota),
            })
            return

        client_ip = self.client_address[0]
        now = time.monotonic()
        wait_seconds = MIN_REQUEST_INTERVAL - (now - last_request_by_ip.get(client_ip, 0))
        if wait_seconds > 0:
            self.send_json(429, {'error': f'Espera {int(wait_seconds) + 1} s antes de enviar otro mensaje.'})
            return
        last_request_by_ip[client_ip] = now

        system_prompt = build_chat_system_prompt(
            agent_name.strip(), agent_instructions, explain_steps, web_search,
        )
        reserved_tokens = len(system_prompt.encode('utf-8')) + sum(
            len(message['content'].encode('utf-8')) for message in clean_messages
        ) + MAX_OUTPUT_TOKENS + (len(image_urls) * 1200) + (2500 if audio_data else 0)
        if not reserve_tokens(user_id, reserved_tokens, quota):
            usage = read_token_usage(user_id, quota)
            model_scope = f' para {model["name"]}' if len(quota) > 1 or quota[0]['bucket'] != 'account' else ''
            self.send_json(402, {
                'error': f'Agotaste los tokens disponibles de tu plan {quota[0]["plan"]}{model_scope}. Se renovarán al comenzar el próximo ciclo.',
                'usage': usage,
            })
            return

        provider_messages = clean_messages[-12:]
        if image_urls or audio_data:
            parts = [{'type': 'text', 'text': provider_messages[-1]['content']}]
            parts.extend({'type': 'image_url', 'image_url': {'url': image_url}} for image_url in image_urls)
            if audio_data:
                parts.append({'type': 'input_audio', 'input_audio': {'data': audio_data, 'format': audio_format}})
            provider_messages = [*provider_messages[:-1], {'role': 'user', 'content': parts}]
        request_body = json.dumps({
            'model': model['providerModel'],
            'messages': [{'role': 'system', 'content': system_prompt}, *provider_messages],
            'max_tokens': MAX_OUTPUT_TOKENS,
            'temperature': 0.7,
            **({'plugins': [{'id': 'web', 'max_results': 5}]} if web_search else {}),
        }).encode('utf-8')
        upstream = Request(
            OPENROUTER_URL,
            data=request_body,
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
                'HTTP-Referer': f'http://127.0.0.1:{self.server.server_port}',
                'X-Title': 'Nexus AI',
            },
            method='POST',
        )

        try:
            with urlopen(upstream, timeout=90) as response:
                result = json.loads(response.read())
            response_message = result.get('choices', [{}])[0].get('message', {})
            answer = response_message.get('content')
            if isinstance(answer, list):
                answer = ''.join(part.get('text', '') for part in answer if isinstance(part, dict))
            if not isinstance(answer, str) or not answer.strip():
                settle_tokens(user_id, reserved_tokens, bucket=quota)
                self.send_json(502, {'error': 'El modelo devolvio una respuesta vacia.'})
                return
            usage = result.get('usage') or {}
            prompt_tokens = usage.get('prompt_tokens')
            completion_tokens = usage.get('completion_tokens')
            if not isinstance(prompt_tokens, int) or not isinstance(completion_tokens, int):
                settle_tokens(user_id, reserved_tokens, bucket=quota)
                self.send_json(502, {'error': 'OpenRouter no devolvio el uso de tokens; no se puede actualizar tu cuota.'})
                return
            settle_tokens(user_id, reserved_tokens, prompt_tokens, completion_tokens, quota)
            record_usage_event(user_id, alias, conversation_id, prompt_tokens, completion_tokens)
            current_usage = read_token_usage(user_id, quota)
            used_tokens = current_usage['usedTokens']
            self.send_json(200, {
                'answer': answer.strip(),
                'model': alias,
                'sources': [
                    {'url': citation.get('url_citation', {}).get('url', ''), 'title': citation.get('url_citation', {}).get('title', '')}
                    for citation in response_message.get('annotations', [])
                    if isinstance(citation, dict)
                    and isinstance(citation.get('url_citation'), dict)
                    and str(citation['url_citation'].get('url', '')).startswith('https://')
                ][:8],
                'usage': {
                    **current_usage,
                    'usedTokens': used_tokens,
                    'promptTokensThisTurn': prompt_tokens,
                    'completionTokensThisTurn': completion_tokens,
                },
            })
        except HTTPError as error:
            settle_tokens(user_id, reserved_tokens, bucket=quota)
            status_messages = {
                401: 'Nexus rechazó la clave. Comprueba que sea válida y tenga acceso.',
                402: 'Nexus no pudo cubrir esta solicitud. Prueba otro modelo o revisa tu saldo.',
                403: 'El proveedor no permite esta solicitud para el modelo seleccionado.',
                404: f'Nexus no encuentra el modelo configurado para {alias}.',
                429: 'Este modelo alcanzó su límite temporal. Espera un poco o prueba otro.',
            }
            try:
                upstream_error = json.loads(error.read()).get('error', {})
                upstream_message = upstream_error.get('message', '') if isinstance(upstream_error, dict) else str(upstream_error)
            except (json.JSONDecodeError, UnicodeDecodeError):
                upstream_message = ''
            message = status_messages.get(error.code, 'Nexus no pudo completar la solicitud.')
            if upstream_message:
                if 'text-to-speech model' in upstream_message.lower() or '/audio/speech' in upstream_message.lower():
                    message = 'El proveedor configurado es de texto a voz y no puede responder en el chat. Asígnale un modelo conversacional desde Panel admin > Modelos IA.'
                else:
                    message = f'{message} Detalle: {" ".join(upstream_message.split())[:180]}'
            self.send_json(error.code if error.code in (401, 402, 403, 429) else 502, {
                'error': message
            })
        except (TimeoutError, URLError, json.JSONDecodeError):
            settle_tokens(user_id, reserved_tokens, bucket=quota)
            self.send_json(502, {'error': 'No se pudo conectar con Nexus. Intentalo de nuevo.'})

    def do_DELETE(self):
        request_path = urlsplit(self.path).path
        prefix = '/api/developer/keys/'
        if request_path.startswith(prefix):
            self.revoke_developer_api_key(request_path[len(prefix):])
            return
        self.send_json(404, {'error': 'Ruta no encontrada.'})

    def do_OPTIONS(self):
        if urlsplit(self.path).path.startswith('/v1/'):
            self.send_response(204)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-API-Key')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Max-Age', '600')
            self.end_headers()
            return
        self.send_json(404, {'error': 'Ruta no encontrada.'})


if __name__ == '__main__':
    initialize_usage_db()

    port = int(os.environ.get('PORT', '8000'))
    host = '0.0.0.0'

    server = ThreadingHTTPServer((host, port), AppHandler)

    print(f'Nexus Forma disponible en puerto {port}')
    server.serve_forever()