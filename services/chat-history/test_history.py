"""Integration checks against chat_memory; uses and removes only its own fixture."""
import json,uuid
from app import connect,handle,owner,explicit_profile

token=str(uuid.uuid4());other=str(uuid.uuid4());key=owner({'visitor_token':token})[1]
try:
    assert explicit_profile("Меня зовут Алексей я хочу полувагон")["name"] == "Алексей"
    assert "company" not in explicit_profile("Какая у меня компания и email?")
    handle('/prepare',{'visitor_token':token,'session_id':token+':fixture','query':'Меня зовут Алексей, моя компания ТестЛогистика. Email test@example.com, телефон +7 900 000 00 01.'})
    with connect() as c:
        for i in range(12):
            c.execute('INSERT INTO provagon_chat_memory(session_id,message) VALUES(%s,%s)',('provagon:'+token+':fixture',json.dumps({'type':'human' if i%2==0 else 'ai','content':f'Fixture {i}'})))
    history=handle('/history',{'visitor_token':token})
    assert len(history['messages'])==10
    assert [m['content'] for m in history['messages']]==[f'Fixture {i}' for i in range(2,12)]
    assert history['profile']['name']=='Алексей'
    assert history['profile']['company']=='ТестЛогистика'
    assert history['profile']['email']=='test@example.com'
    assert handle('/history',{'visitor_token':other})['messages']==[]
    assert handle('/history',{'visitor_token':other})['profile']=={}
    fresh=handle('/prepare',{'visitor_token':token,'session_id':token+':new','query':'Какая у меня компания и email?'})
    assert fresh['profile']['company']=='ТестЛогистика'
    assert fresh['profile']['email']=='test@example.com'
    try:handle('/history',{})
    except ValueError:pass
    else:raise AssertionError('Missing browser key accepted')
    try:handle('/prepare',{'visitor_token':other,'session_id':token+':fixture','query':'Чужой диалог'})
    except ValueError:pass
    else:raise AssertionError('Foreign session accepted')
    print('PASS: last 10 messages, chronological order, persistent profile, visitor isolation, foreign-session rejection')
finally:
    with connect() as c:
        c.execute('DELETE FROM provagon_chat_memory WHERE session_id=%s',('provagon:'+token+':fixture',))
        c.execute('DELETE FROM visitor_profiles WHERE owner_hash IN (%s,%s)',(key,owner({'visitor_token':other})[1]))
