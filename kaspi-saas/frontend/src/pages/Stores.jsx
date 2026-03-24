import { useState, useEffect } from 'react'
import { Plus, Trash2, CheckCircle, XCircle, RefreshCw, Eye, EyeOff } from 'lucide-react'
import api from '../api/client'

export default function Stores() {
  const [stores, setStores] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [checkingId, setCheckingId] = useState(null)
  const [showCookies, setShowCookies] = useState({})
  const [form, setForm] = useState({ seller_id: '', store_id: '', city_id: '750000000', cookies: '' })

  useEffect(() => { loadStores() }, [])

  async function loadStores() {
    const { data } = await api.get('/stores/')
    setStores(data)
  }

  async function addStore(e) {
    e.preventDefault()
    try {
      await api.post('/stores/', form)
      await loadStores()
      setShowAdd(false)
      setForm({ seller_id: '', store_id: '', city_id: '750000000', cookies: '' })
    } catch (err) {
      alert(err.response?.data?.detail || 'Ошибка')
    }
  }

  async function checkSession(id) {
    setCheckingId(id)
    try {
      const { data } = await api.get(`/stores/${id}/check-session`)
      alert(data.message)
    } finally {
      setCheckingId(null)
      loadStores()
    }
  }

  async function deleteStore(id) {
    if (!confirm('Удалить магазин? Все товары тоже будут удалены.')) return
    await api.delete(`/stores/${id}`)
    setStores(s => s.filter(x => x.id !== id))
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Магазины</h1>
          <p className="text-gray-400 mt-1">Подключите Kaspi магазин через куки сессии</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-medium"
        >
          <Plus size={18} /> Добавить магазин
        </button>
      </div>

      {/* How to get cookies */}
      <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 mb-6 text-sm">
        <p className="font-medium text-blue-400 mb-2">Как получить куки сессии:</p>
        <ol className="list-decimal list-inside space-y-1 text-gray-300">
          <li>Войди в <strong>kaspi.kz/mc</strong> в браузере</li>
          <li>Нажми F12 → вкладка <strong>Application</strong> → <strong>Cookies</strong></li>
          <li>В консоли (F12 → Console) введи: <code className="bg-gray-800 px-1 rounded">copy(document.cookie)</code></li>
          <li>Вставь скопированные куки в поле ниже</li>
          <li>Seller ID и Store ID найди в URL кабинета: mc.shop.kaspi.kz/<strong>30432443</strong></li>
        </ol>
      </div>

      {showAdd && (
        <form onSubmit={addStore} className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-4">
          <h3 className="font-semibold mb-4">Новый магазин</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Seller ID (merchantUid)</label>
                <input
                  placeholder="30432443"
                  value={form.seller_id}
                  onChange={e => setForm({ ...form, seller_id: e.target.value, store_id: e.target.value + '_PP1' })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Store ID</label>
                <input
                  placeholder="30432443_PP1"
                  value={form.store_id}
                  onChange={e => setForm({ ...form, store_id: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Куки сессии (скопируй из браузера)</label>
              <textarea
                placeholder="ks.tg=31; mc-session=abc...; mc-sid=xyz..."
                value={form.cookies}
                onChange={e => setForm({ ...form, cookies: e.target.value })}
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 font-mono"
                required
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm">
              Добавить
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm">
              Отмена
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {stores.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
            Нет подключённых магазинов
          </div>
        ) : stores.map(s => (
          <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{s.seller_id}</div>
                <div className="text-xs text-gray-500 mt-0.5">Store: {s.store_id} · City: {s.city_id}</div>
                {s.last_session_check && (
                  <div className="text-xs text-gray-600 mt-0.5">
                    Проверено: {new Date(s.last_session_check).toLocaleString('ru')}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => checkSession(s.id)}
                  disabled={checkingId === s.id}
                  className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-sm px-3 py-1.5 rounded-lg transition-colors"
                >
                  {checkingId === s.id
                    ? <RefreshCw size={14} className="animate-spin" />
                    : <RefreshCw size={14} />
                  }
                  Проверить сессию
                </button>
                <button onClick={() => deleteStore(s.id)} className="text-gray-600 hover:text-red-400 transition-colors p-1.5">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
