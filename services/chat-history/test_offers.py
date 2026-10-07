"""Mail logic integration checks. Never contacts an email provider."""
import json,os,uuid
from app import connect,handle,owner
from offers import requested

token=str(uuid.uuid4());key=owner({'visitor_token':token})[1];sid=token+':mail-fixture'
try:
    assert requested('Отправьте КП на почту')
    assert not requested('Не отправляйте КП на почту')
    assert not requested('Как отправить КП на почту?')
    assert not requested('Ты уже отправил КП?')
    handle('/prepare',{'visitor_token':token,'session_id':sid,'query':'Меня зовут Алексей, моя компания Тест. Email test@example.com.'})
    data={'visitor_token':token,'session_id':sid,'query':'Отправьте КП на почту','analysis':json.dumps({'send_requested':True,'items':[{'model_id':'gv-12-9046','quantity':2}]})}
    draft=handle('/offer/prepare',data)
    assert draft['status']=='draft' and draft['dispatch_ready'] is False
    assert draft['to_email']=='test@example.com' and draft['cc_email']=='provagon@outlook.com'
    assert draft['from_email']=='provagon@outlook.com'
    assert '4 550 000' in draft['html'] and '<th>Количество' in draft['html']
    assert 'Тест' in draft['html'] and 'ПРОВАГОН' in draft['html']
    no_consent=handle('/offer/prepare',{**data,'query':'Покажи характеристики'})
    assert no_consent['status']=='not_requested'
    unknown=handle('/offer/prepare',{**data,'analysis':json.dumps({'send_requested':True,'items':[{'model_id':'fake','quantity':2}]})})
    assert unknown['status']=='unknown_model'
    os.environ['MAIL_ENABLED']='true' # Only simulates n8n dispatch permission; sends nothing.
    ready=handle('/offer/prepare',data);assert ready['dispatch_ready']
    again=handle('/offer/prepare',data);assert not again['dispatch_ready'] and again['status']=='pending'
    result=handle('/offer/status',{'visitor_token':token,'offer_id':ready['offer_id'],'status':'sent'})
    assert result['updated']
    duplicate=handle('/offer/prepare',data);assert not duplicate['dispatch_ready'] and duplicate['status']=='sent'
    print('PASS: request gate, recipient and CC, catalogue pricing, draft, missing model rejection, duplicate prevention, confirmed-send status')
finally:
    with connect() as c:
        c.execute('DELETE FROM commercial_offers WHERE owner_hash=%s',(key,))
        c.execute('DELETE FROM visitor_profiles WHERE owner_hash=%s',(key,))
