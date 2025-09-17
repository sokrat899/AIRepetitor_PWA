import React, { useEffect, useMemo, useState } from 'react'

const DEFAULT_FREE = 25
const LS = {
  credits: 'airep_credits',
  chats: 'airep_chats',
  activeId: 'airep_active'
}
const uid = () => Math.random().toString(36).slice(2)

function loadCredits(){
  const n = Number(localStorage.getItem(LS.credits))
  if (Number.isFinite(n) && n>=0) return n
  localStorage.setItem(LS.credits, String(DEFAULT_FREE))
  return DEFAULT_FREE
}
function saveCredits(n){ localStorage.setItem(LS.credits, String(n)) }

function loadChats(){
  try { return JSON.parse(localStorage.getItem(LS.chats) || '[]') } catch { return [] }
}
function saveChats(chats){ localStorage.setItem(LS.chats, JSON.stringify(chats)) }

const initialMessage = { id: uid(), role: 'assistant', content: 'Привет! Я AIRepetitor. Задай вопрос по учебе 😊' }

export default function App(){
  const [credits, setCredits] = useState(loadCredits())
  const [chats, setChats] = useState(loadChats())
  const [activeId, setActiveId] = useState(localStorage.getItem(LS.activeId) || null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [apiKey, setApiKey] = useState(localStorage.getItem('VITE_OPENAI_API_KEY') || '')

  useEffect(() => { saveCredits(credits) }, [credits])
  useEffect(() => { saveChats(chats) }, [chats])
  useEffect(() => { if(!activeId && chats.length){ setActiveId(chats[0].id) } }, [activeId, chats])
  useEffect(() => { localStorage.setItem('VITE_OPENAI_API_KEY', apiKey) }, [apiKey])

  const activeChat = useMemo(() => chats.find(c => c.id===activeId), [chats, activeId])

  function newChat(){
    const id = uid()
    const chat = { id, title: 'Новый диалог', created: Date.now(), messages: [initialMessage] }
    const next = [chat, ...chats]
    setChats(next)
    setActiveId(id)
  }
  function renameChat(id){
    const title = prompt('Новое название диалога:')
    if(!title) return
    setChats(chats.map(c => c.id===id ? {...c, title} : c))
  }
  function removeChat(id){
    const ok = confirm('Удалить диалог?')
    if(!ok) return
    const next = chats.filter(c => c.id!==id)
    setChats(next)
    if(activeId===id) setActiveId(next[0]?.id || null)
  }

  async function ask(){
    if (!input.trim()) return
    if (credits <= 0 && apiKey) { alert('Лимит вопросов исчерпан. Пополните лимит.'); return }
    const userMsg = { id: uid(), role: 'user', content: input.trim() }
    setInput('')
    const id = activeId || uid()
    let chat = activeChat
    if(!chat){
      chat = { id, title: 'Новый диалог', created: Date.now(), messages: [initialMessage] }
    }
    const newMsgs = [...chat.messages, userMsg, { id: uid(), role: 'assistant', content: 'Думаю над ответом…' }]
    const nextChats = chats.some(c => c.id===id) ? chats.map(c => c.id===id ? {...c, messages: newMsgs} : c) : [{...chat, messages: newMsgs}, ...chats]
    setChats(nextChats)
    setActiveId(id)
    setLoading(true)
    try {
      let answer = ''
      if (apiKey) {
        // Live mode: OpenAI Chat Completions (gpt-4o-mini)
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'Ты дружелюбный русскоязычный ИИ-репетитор. Отвечай кратко и по делу, добавляй примеры.'},
              ...newMsgs.filter(m => m.role!=='assistant' || m.content!=='Думаю над ответом…').map(({role, content}) => ({role, content}))
            ]
          })
        })
        if(!resp.ok){
          const text = await resp.text()
          throw new Error('API error: '+text)
        }
        const data = await resp.json()
        answer = data.choices?.[0]?.message?.content || 'Не удалось получить ответ.'
        // списываем вопрос
        setCredits(c => Math.max(0, c-1))
      } else {
        // Demo mode
        answer = 'Демо-режим: добавьте API-ключ OpenAI вверху, чтобы получать реальные ответы.\n\nПодсказка: распишите условие, приведите свой подход — и я помогу шаг за шагом.'
      }
      setChats(chs => chs.map(c => c.id===id ? {
        ...c,
        messages: c.messages.slice(0, -1).concat([{ id: uid(), role: 'assistant', content: answer }])
      } : c))
    } catch (e){
      setChats(chs => chs.map(c => c.id===id ? {
        ...c,
        messages: c.messages.slice(0, -1).concat([{ id: uid(), role: 'assistant', content: 'Ошибка: '+e.message }])
      } : c))
    } finally {
      setLoading(false)
    }
  }

  function addCredits(n){ setCredits(c => c + n) }

  return (
    <div style={{display:'grid', gridTemplateColumns:'280px 1fr', gap:16, padding:16, height:'100%'}}>
      {/* Sidebar */}
      <aside className="card" style={{padding:16, overflow:'auto'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:8}}>
          <h2 style={{margin:0}}>AIRepetitor</h2>
          <button className="btn btn-primary" onClick={newChat}>+ Новый</button>
        </div>
        <div style={{marginTop:12, fontSize:14, opacity:.9}}>Осталось вопросов: <b>{credits}</b></div>
        <div style={{display:'flex', gap:8, marginTop:8}}>
          <button className="btn btn-ghost" onClick={()=>addCredits(25)}>Купить +25</button>
          <button className="btn btn-ghost" onClick={()=>addCredits(100)}>Купить +100</button>
        </div>
        <div style={{marginTop:12}}>
          <label style={{fontSize:12, opacity:.9}}>OpenAI API ключ (не обязательно)</label>
          <input className="input" placeholder="sk-..." value={apiKey} onChange={e=>setApiKey(e.target.value)} />
          <div style={{fontSize:12, opacity:.8, marginTop:6}}>Без ключа будет демо‑ответ.</div>
        </div>
        <hr style={{border:'none', borderTop:'1px solid rgba(255,255,255,.2)', margin:'16px 0'}}/>
        <div style={{fontSize:12, opacity:.9, marginBottom:6}}>История диалогов</div>
        <div style={{display:'grid', gap:8}}>
          {chats.map(c => (
            <div key={c.id} className="card" style={{padding:8, cursor:'pointer'}} onClick={()=>setActiveId(c.id)}>
              <div style={{display:'flex', gap:8, alignItems:'center', justifyContent:'space-between'}}>
                <div style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:160}}>
                  <b style={{opacity: activeId===c.id ? 1 : .9}}>{c.title}</b>
                  <div style={{fontSize:12, opacity:.8}}>{new Date(c.created).toLocaleString()}</div>
                </div>
                <div style={{display:'flex', gap:6}} onClick={e=>e.stopPropagation()}>
                  <button className="btn btn-ghost" onClick={()=>renameChat(c.id)}>✏️</button>
                  <button className="btn btn-ghost" onClick={()=>removeChat(c.id)}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
          {chats.length===0 && <div className="card" style={{padding:8, fontSize:14, opacity:.9}}>Нет диалогов</div>}
        </div>
      </aside>
      {/* Main */}
      <main className="card" style={{padding:16, display:'grid', gridTemplateRows:'auto 1fr auto', height:'100%'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:8}}>
          <h3 style={{margin:0}}>{activeChat?.title || 'Новый диалог'}</h3>
          <div style={{fontSize:12, opacity:.85}}>{loading ? 'Модель думает…' : 'Готов к вопросам'}</div>
        </div>
        <div id="messages" style={{overflow:'auto', marginTop:12, display:'grid', gap:10}}>
          {(activeChat?.messages || [initialMessage]).map(m => (
            <div key={m.id} className={'chat fade-in'} style={{justifyContent: m.role==='user' ? 'flex-end' : 'flex-start'}}>
              <div className={'bubble '+(m.role==='user'?'me':'')}>
                <div style={{fontSize:12, opacity:.8, marginBottom:4}}>{m.role==='user'?'Вы':'AI'}</div>
                <div style={{whiteSpace:'pre-wrap'}}>{m.content}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{display:'grid', gap:8, gridTemplateColumns:'1fr auto'}}>
          <textarea className="textarea" placeholder="Сформулируйте вопрос..." value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); ask(); }}}/>
          <button className="btn btn-primary" onClick={ask} disabled={loading || (!apiKey && !input.trim())}>{loading?'...':'Отправить'}</button>
        </div>
        <div style={{fontSize:12, opacity:.8, marginTop:6}}>Подсказка: Shift+Enter — перенос строки</div>
      </main>
    </div>
  )
}