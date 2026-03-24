import { useState, useEffect } from 'react'
import { User, Store, Plus, Trash2, Save, Eye, EyeOff } from 'lucide-react'
import api from '../api/client'

export default function Profile() {
  const [user, setUser] = useState(null)
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddStore, setShowAddStore] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showCookies, setShowCookies] = useState({})
  const [storeForm, setStoreForm] = useState({ seller_id: '', store_id: '', city_id: '750000000', kaspi_api_token: '', mc_session: '', mc_sid: '', cookies: '' })
  const [nameForm, setNameForm] = useState('')

  useEffect(() => {
    Promise.all([api.get('/auth/me'), api.get('/stores/')]).then(([u, s]) => {
      setUser(u.data)
      setNameForm(u.data.name || '')
      setStores(s.data)
    }).finally(() => setLoading(false))
  }, [])

  async function saveName(e) {
    e.preventDefault()
    await api.put('/auth/me', { name: nameForm })
    setUser(u => ({ ...u, name: nameForm }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function addStore(e) {
    e.preventDefault()
    try {
      const { data } = await api.post('/stores/', storeForm)
      setStores(s => [...s, data])
      setShowAddStore(false)
      setStoreForm({ seller_id: '', store_id: '', city_id: '750000000', kaspi_api_token: '', mc_session: '', mc_sid: '', cookies: '' })
    } catch (err) {
      alert(err.response?.data?.detail || 'Ошибка')
    }
  }

  async function deleteStore(id) {
    if (!confirm('Удалить магазин?')) return
    await api.delete(`/stores/${id}`)
    setStores(s => s.filter(x => x.id !== id))
  }

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400">Загрузка...</div>

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Профиль</h1>
        <p className="text-gray-400 mt-1">Аккаунт и привязанные магазины</p>
      </div>

      {/* Account */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <User size={18} className="text-blue-400" />
          <h2 className="font-semibold">Аккаунт</h2>
        </div>
        <form onSubmit={saveName} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Номер телефона</label>
            <input value={user?.phone || ''} disabled className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Имя</label>
            <input
              value={nameForm}
              onChange={e => setNameForm(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Тарифный план</label>
            <input value={user?.plan || 'free'} disabled className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed capitalize" />
          </div>
          <button type="submit" className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${saved ? 'bg-green-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
            <Save size={14} />
            {saved ? 'Сохранено!' : 'Сохранить'}
          </button>
        </form>
      </div>

      {/* Stores / API Keys */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Store size={18} className="text-yellow-400" />
            <h2 className="font-semibold">Магазины (Kaspi куки)</h2>
          </div>
          <button
            onClick={() => setShowAddStore(true)}
            className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            <Plus size={15} /> Добавить
          </button>
        </div>

        {showAddStore && (
          <form onSubmit={addStore} className="bg-gray-800 rounded-xl p-4 mb-4 space-y-3">
            <h3 className="text-sm font-medium">Новый магазин</h3>
            <input className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="Seller ID (merchantUid) *" value={storeForm.seller_id} onChange={e => setStoreForm({ ...storeForm, seller_id: e.target.value })} required />
            <input className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="Store ID (sellerId_PP1)" value={storeForm.store_id} onChange={e => setStoreForm({ ...storeForm, store_id: e.target.value })} />
            <input className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="ID города (750000000 = Алматы)" value={storeForm.city_id} onChange={e => setStoreForm({ ...storeForm, city_id: e.target.value })} />

            {/* API Token - preferred method */}
            <div className="border border-yellow-600/30 rounded-lg p-3 space-y-2 bg-yellow-500/5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-yellow-400">Kaspi API Токен</span>
                <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">Рекомендуется</span>
              </div>
              <p className="text-xs text-gray-500">Найти в Kaspi Merchant Cabinet → Настройки → API токен</p>
              <input
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500 font-mono"
                placeholder="merchantId:tokenHash"
                value={storeForm.kaspi_api_token}
                onChange={e => setStoreForm({ ...storeForm, kaspi_api_token: e.target.value })}
              />
            </div>

            {/* Session cookies - separate fields */}
            <div className="border border-blue-600/30 rounded-lg p-3 space-y-2 bg-blue-500/5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-blue-400">Сессионные куки Kaspi</span>
                <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">Работает стабильно</span>
              </div>
              <p className="text-xs text-gray-500">
                F12 → Application → Cookies → mc.shop.kaspi.kz → скопируйте значения mc-session и mc-sid
              </p>
              <div>
                <label className="block text-xs text-gray-500 mb-1">mc-session</label>
                <input
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-mono"
                  placeholder="Значение mc-session..."
                  value={storeForm.mc_session}
                  onChange={e => setStoreForm({ ...storeForm, mc_session: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">mc-sid</label>
                <input
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-mono"
                  placeholder="Значение mc-sid..."
                  value={storeForm.mc_sid}
                  onChange={e => setStoreForm({ ...storeForm, mc_sid: e.target.value })}
                />
              </div>
            </div>

            {/* Full cookies string - last resort */}
            <details className="group">
              <summary className="text-xs text-gray-600 hover:text-gray-400 cursor-pointer select-none">
                Или вставить все куки строкой (устаревший способ)
              </summary>
              <textarea
                className="mt-2 w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 resize-none font-mono"
                placeholder="cookie1=value1; cookie2=value2; ..."
                rows={3}
                value={storeForm.cookies}
                onChange={e => setStoreForm({ ...storeForm, cookies: e.target.value })}
              />
            </details>

            <div className="flex gap-2">
              <button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm">Добавить</button>
              <button type="button" onClick={() => setShowAddStore(false)} className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg text-sm">Отмена</button>
            </div>
          </form>
        )}

        {stores.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">Нет привязанных магазинов</p>
        ) : (
          <div className="space-y-3">
            {stores.map(s => (
              <div key={s.id} className="bg-gray-800 rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-sm">{s.seller_id}</div>
                    {s.store_id && <div className="text-xs text-gray-500 mt-0.5">{s.store_id}</div>}
                    <div className="text-xs text-gray-600 mt-0.5">Город: {s.city_id}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.kaspi_api_token ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">API токен</span>
                    ) : (s.mc_session || s.mc_sid) ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">Сессия</span>
                    ) : s.cookies ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-600 text-gray-400">Куки</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">Нет авторизации</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.is_active ? 'bg-green-500/10 text-green-400' : 'bg-gray-700 text-gray-500'}`}>
                      {s.is_active ? 'Активен' : 'Неактивен'}
                    </span>
                    <button onClick={() => deleteStore(s.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {s.kaspi_api_token && (
                  <div className="mt-2">
                    <button
                      onClick={() => setShowCookies(prev => ({ ...prev, [`token_${s.id}`]: !prev[`token_${s.id}`] }))}
                      className="flex items-center gap-1 text-xs text-yellow-600 hover:text-yellow-400 transition-colors"
                    >
                      {showCookies[`token_${s.id}`] ? <EyeOff size={12} /> : <Eye size={12} />}
                      {showCookies[`token_${s.id}`] ? 'Скрыть' : 'Показать'} API токен
                    </button>
                    {showCookies[`token_${s.id}`] && (
                      <div className="mt-1.5 text-xs text-gray-500 bg-gray-900 rounded p-2 font-mono break-all max-h-16 overflow-auto">
                        {s.kaspi_api_token}
                      </div>
                    )}
                  </div>
                )}

                {s.cookies && (
                  <div className="mt-1">
                    <button
                      onClick={() => setShowCookies(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showCookies[s.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                      {showCookies[s.id] ? 'Скрыть' : 'Показать'} куки
                    </button>
                    {showCookies[s.id] && (
                      <div className="mt-1.5 text-xs text-gray-500 bg-gray-900 rounded p-2 font-mono break-all max-h-20 overflow-auto">
                        {s.cookies}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
