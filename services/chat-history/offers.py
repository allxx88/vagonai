"""Generate branded offers from the catalogue; n8n owns email transport."""
import hashlib,html,json,os,re,uuid
from pathlib import Path

CATALOG={w['id']:{**w,'category':c['title']} for c in json.loads(Path('/app/catalog.json').read_text()) for w in c['wagons']}
SENDER='info@provagon.ru'
COPY_TO='provagon@outlook.com'
def ensure_tables(c):
    c.execute('''CREATE TABLE IF NOT EXISTS commercial_offers(
        id uuid PRIMARY KEY, owner_hash text NOT NULL, session_id text NOT NULL,
        fingerprint text NOT NULL UNIQUE, recipient text NOT NULL, subject text NOT NULL,
        html text NOT NULL, items jsonb NOT NULL, status text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz,
        error text)''')
def requested(query):
    if not isinstance(query,str):return False
    if re.search(r'\bне\s+(?:хочу\s+|надо\s+|нужно\s+)?(?:отправ|присыл|высыла|посыл|получ)',query,re.I):return False
    if re.search(r'\b(?:как|когда|почему)\b',query,re.I):return False
    return bool(re.search(r'\b(?:отправь(?:те)?|пришли(?:те)?|вышли(?:те)?|направь(?:те)?|выслать|прислать|отправить|получить|скинь(?:те)?)\b',query,re.I) and re.search(r'(\bкп\b|коммерческ|предложени|почт|e-?mail|@)',query,re.I))
def parse_analysis(raw):
    if isinstance(raw,dict):return raw
    if not isinstance(raw,str):return {}
    try:
        match=re.search(r'\{[\s\S]*\}',raw)
        return json.loads(match.group()) if match else {}
    except ValueError:return {}
def offer_html(profile,items):
    esc=lambda value:html.escape(str(value),quote=True)
    rows=''.join('<tr><td>'+esc(CATALOG[x['model_id']]['category'])+'</td><td>'+esc(CATALOG[x['model_id']]['model'])+'</td><td>'+str(x['quantity'])+'</td><td>'+esc(CATALOG[x['model_id']]['price'])+'</td></tr>' for x in items)
    return '<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;color:#19252d"><h1 style="color:#318b5d">ПРОВАГОН</h1><h2>Коммерческое предложение</h2><p>Здравствуйте'+(', '+esc(profile['name']) if profile.get('name') else '')+'!</p>'+('<p>Для компании: '+esc(profile['company'])+'</p>' if profile.get('company') else '')+'<p>Благодарим за обращение. Предлагаем следующие позиции из каталога Провагон:</p><table border="1" cellpadding="10" cellspacing="0"><thead><tr><th>Тип</th><th>Модель</th><th>Количество, шт.</th><th>Цена за единицу по каталогу</th></tr></thead><tbody>'+rows+'</tbody></table><p>Цены приведены в том виде, в котором опубликованы в каталоге. Окончательная стоимость, наличие, комплектация, налоги, сроки поставки и условия оплаты уточняются перед заключением договора.</p><p>С уважением,<br><strong>Провагон</strong><br><a href="https://provagon.ru/">provagon.ru</a><br><a href="mailto:info@provagon.ru">info@provagon.ru</a></p></body></html>'
def prepare(c,key,token,data):
    if not requested(data.get('query','')):return {'dispatch_ready':False,'status':'not_requested'}
    sid=data.get('session_id','')
    if not isinstance(sid,str) or not sid.startswith(token+':'):raise ValueError('Foreign session')
    row=c.execute('SELECT profile FROM visitor_profiles WHERE owner_hash=%s',(key,)).fetchone()
    profile=row['profile'] if row else {}
    recipient=profile.get('email','').strip()
    if not re.fullmatch(r'[A-Za-z0-9.!#$%&\x27*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}',recipient) or len(recipient)>254:
        return {'dispatch_ready':False,'status':'missing_email'}
    analysis=parse_analysis(data.get('analysis',''))
    if analysis.get('send_requested') is not True:return {'dispatch_ready':False,'status':'not_requested'}
    items=analysis.get('items',[])
    if not isinstance(items,list) or not items or len(items)>20:return {'dispatch_ready':False,'status':'missing_items'}
    merged={}
    for x in items:
        if not isinstance(x,dict) or x.get('model_id') not in CATALOG:return {'dispatch_ready':False,'status':'unknown_model'}
        qty=x.get('quantity')
        if type(qty) is not int or not 1<=qty<=10000:return {'dispatch_ready':False,'status':'missing_quantity'}
        merged[x['model_id']]=merged.get(x['model_id'],0)+qty
    items=[{'model_id':k,'quantity':v} for k,v in sorted(merged.items())]
    fingerprint=hashlib.sha256(json.dumps([key,sid,recipient.lower(),items],sort_keys=True).encode()).hexdigest()
    enabled=os.environ.get('MAIL_ENABLED','false').lower()=='true'
    oid=str(uuid.uuid4());subject='Провагон — коммерческое предложение';content=offer_html(profile,items)
    row=c.execute('''INSERT INTO commercial_offers(id,owner_hash,session_id,fingerprint,recipient,subject,html,items,status)
        VALUES(%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s) ON CONFLICT(fingerprint) DO NOTHING RETURNING id,status''',
        (oid,key,sid,fingerprint,recipient,subject,content,json.dumps(items),'pending' if enabled else 'draft')).fetchone()
    if not row:
        row=c.execute('SELECT id,status FROM commercial_offers WHERE fingerprint=%s AND owner_hash=%s',(fingerprint,key)).fetchone()
        if enabled and row['status'] in ('draft','failed'):
            row=c.execute("UPDATE commercial_offers SET status='pending',error=NULL WHERE id=%s AND status IN ('draft','failed') RETURNING id,status",(row['id'],)).fetchone()
            if not row:return {'dispatch_ready':False,'status':'pending'}
        else:return {'dispatch_ready':False,'status':row['status'],'offer_id':str(row['id'])}
    return {'dispatch_ready':enabled,'status':row['status'],'offer_id':str(row['id']),
        'visitor_token':token,'to_email':recipient,'cc_email':COPY_TO,'from_email':SENDER,'subject':subject,'html':content}
def update(c,key,data):
    status=data.get('status')
    if status not in ('sent','failed'):raise ValueError('Invalid status')
    row=c.execute("UPDATE commercial_offers SET status=%s,sent_at=CASE WHEN %s='sent' THEN now() ELSE sent_at END,error=%s WHERE id=%s AND owner_hash=%s AND status='pending' RETURNING id,status",(status,status,'Email transport failed' if status=='failed' else None,data.get('offer_id'),key)).fetchone()
    return {'updated':bool(row),'status':row['status'] if row else 'unchanged'}
