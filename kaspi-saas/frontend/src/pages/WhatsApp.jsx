import { useState, useEffect } from 'react'
import { MessageCircle, Send, Key, CheckCircle, AlertCircle } from 'lucide-react'
import api from '../api/client'

const TEMPLATES = [
  { id: 1, name: 'Заказ принят', text: 'Здравствуйте, {name}! Ваш заказ #{order_id} на товар «{product}» принят. Доставка через {days} дней.' },
  { id: 2, name: 'Заказ отправлен', text: 'Здравствуйте, {name}! Ваш заказ #{order_id} отправлен. Трек-номер: {tracking}.' },
  { id: 3, name: 'Акция', text: 'Здравствуйте! У нас действует специальное предложение — скидки до 30% на весь ассортимент. Успейте купить!' },
]

export default function WhatsApp() {
  const [connected, setConnected] = useState(false)
  const [token, setToken] = useState('')
  const [savedToken, setSavedToken] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0])
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState(TEMPLATES[0].text)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    api.get('/settings/').then(({ data }) => {
      if (data.whatsapp_token) {
        setSavedToken(data.whatsapp_token)
        setToken(data.whatsapp_token)
        setConnected(data.whatsapp_enabled)
      }
    }).finally(() => setLoading(false))
  }, [])

  async function saveToken() {
    await api.put('/settings/', { whatsapp_token: token, whatsapp_enabled: true })
    setSavedToken(token)
    setConnected(true)
  }

  async function disconnect() {
    await api.put('/settings/', { whatsapp_enabled: false })
    setConnected(false)
  }

  function sendMessage(e) {
    e.preventDefault()
    if (!phone) return
    // WhatsApp deep link
    const text = encodeURIComponent(message)
    const cleaned = phone.replace(/\D/g, '')
    window.open(`https://wa.me/${cleaned}?text=${text}`, '_blank')
  }

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400">Загрузка...</div>

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Рассылка</h1>
        <p className="text-gray-400 mt-1">WhatsApp уведомления покупателям</p>
      </div>

      {/* Connection */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageCircle size={18} className="text-green-400" />
            <h2 className="font-semibold">Подключение WhatsApp</h2>
          </div>
          <span className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full ${connected ? 'bg-green-500/10 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
            {connected ? <><CheckCircle size={12} /> Подключено</> : <><AlertCircle size={12} /> Не подключено</>}
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-2 flex items-center gap-1">
              <Key size={13} /> API токен (WhatsApp Business API / CallMeBot)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="Введите API токен..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
              />
              <button onClick={saveToken} disabled={!token} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Сохранить
              </button>
              {connected && (
                <button onClick={disconnect} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm">
                  Отключить
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Поддерживается CallMeBot API. Зарегистрируйтесь на callmebot.com для получения токена.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Templates */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold mb-4 text-sm text-gray-300">Шаблоны сообщений</h2>
          <div className="space-y-2">
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                onClick={() => { setSelectedTemplate(t); setMessage(t.text) }}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-colors ${
                  selectedTemplate.id === t.id ? 'bg-red-600/20 border border-red-600/30 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                }`}
              >
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-gray-500 mt-1 line-clamp-2">{t.text}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Send */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold mb-4 text-sm text-gray-300">Отправить сообщение</h2>
          <form onSubmit={sendMessage} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Номер телефона</label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+77001234567"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Текст сообщения</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={5}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 resize-none"
              />
            </div>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Send size={15} />
              Открыть в WhatsApp
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
