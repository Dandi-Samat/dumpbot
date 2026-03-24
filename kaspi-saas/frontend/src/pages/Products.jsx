import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Trash2, Search, ToggleLeft, ToggleRight, Play, RefreshCw, Download, ExternalLink, MapPin, Zap } from 'lucide-react'
import api from '../api/client'

const AUTO_INTERVAL_MS = 2 * 60 * 1000 // 2 minutes
const AUTO_SYNC_MS = 5 * 60 * 1000 // 5 minutes

const TABS = ['Демпинг', 'Предзаказ']

export default function Products() {
  const [tab, setTab] = useState('Демпинг')
  const [products, setProducts] = useState([])
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [running, setRunning] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [checkingPosition, setCheckingPosition] = useState({})
  const [checkingAll, setCheckingAll] = useState(false)
  const [checkAllProgress, setCheckAllProgress] = useState(null)
  const [competitorModal, setCompetitorModal] = useState(null) // {product, competitors, position, total}
  const [autoRunning, setAutoRunning] = useState(false)
  const [autoLastRun, setAutoLastRun] = useState(null)
  const [autoLog, setAutoLog] = useState([])
  const [countdown, setCountdown] = useState(AUTO_INTERVAL_MS)
  const [syncLastRun, setSyncLastRun] = useState(null)
  const [priceFlash, setPriceFlash] = useState({}) // {id: 'success'|'blocked'|'lower'}
  const productsRef = useRef([])
  const storesRef = useRef([])
  const nextRunRef = useRef(null)
  const [form, setForm] = useState({
    store_id: '', name: '', sku: '', kaspi_url: '',
    my_cost: '', my_price: '', min_price: '', stock: '', min_margin: '500', notes: ''
  })

  useEffect(() => {
    Promise.all([api.get('/products/'), api.get('/stores/')]).then(([p, s]) => {
      setProducts(p.data)
      setStores(s.data)
      productsRef.current = p.data
      storesRef.current = s.data
      if (s.data.length > 0) setForm(f => ({ ...f, store_id: s.data[0].id }))
    }).finally(() => setLoading(false))
  }, [])

  // Keep refs in sync
  useEffect(() => { productsRef.current = products }, [products])
  useEffect(() => { storesRef.current = stores }, [stores])

  // Auto-sync from Kaspi every 5 min
  useEffect(() => {
    const silentSync = async () => {
      const s = storesRef.current
      if (!s || s.length === 0) return
      try {
        await api.post(`/products/sync/${s[0].id}`)
        const { data: prods } = await api.get('/products/')
        setProducts(prods)
        productsRef.current = prods
        setSyncLastRun(new Date())
      } catch {}
    }
    const timer = setInterval(silentSync, AUTO_SYNC_MS)
    return () => clearInterval(timer)
  }, [])

  // Auto-reprice timer
  useEffect(() => {
    nextRunRef.current = Date.now() + AUTO_INTERVAL_MS

    const ticker = setInterval(() => {
      const remaining = nextRunRef.current - Date.now()
      setCountdown(Math.max(0, remaining))
    }, 1000)

    const runner = setInterval(() => {
      nextRunRef.current = Date.now() + AUTO_INTERVAL_MS
      runAutoReprice()
    }, AUTO_INTERVAL_MS)

    return () => {
      clearInterval(ticker)
      clearInterval(runner)
    }
  }, [])

  const runAutoReprice = useCallback(async () => {
    const enabled = productsRef.current.filter(p => p.reprice_enabled && p.sku)
    if (enabled.length === 0) return
    setAutoRunning(true)
    const log = []

    for (const product of enabled) {
      const masterSku = product.sku.split('_')[0]
      try {
        // Browser fetch — residential IP, not blocked by Kaspi
        const resp = await fetch(`https://kaspi.kz/yml/offer-view/offers/${masterSku}`, {
          headers: { 'Accept': 'application/json', 'Referer': 'https://kaspi.kz/' },
        })

        if (!resp.ok) {
          log.push({ name: product.name, status: 'no_data', message: `Kaspi ${resp.status}` })
          continue
        }

        const raw = await resp.json()
        const offers = raw.offers || []
        if (offers.length === 0) {
          log.push({ name: product.name, status: 'no_data', message: 'Нет предложений' })
          continue
        }

        // Exclude our stores
        const myIds = storesRef.current.map(s => String(s.seller_id))
        const competitors = offers.filter(o => !myIds.includes(String(o.merchantId)) && o.price > 0)
        if (competitors.length === 0) {
          log.push({ name: product.name, status: 'no_competitors' })
          continue
        }

        const minPrice = Math.min(...competitors.map(o => Math.round(o.price)))

        // Backend applies price update via Kaspi MC API
        const { data } = await api.post(`/repricer/product/${product.id}/apply`, {
          competitor_price: minPrice,
        })

        log.push(data)

        const flash = data.status === 'success' ? 'success'
          : data.status === 'blocked' ? 'blocked'
          : data.status === 'already_lower' ? 'lower' : null

        if (flash) {
          setPriceFlash(prev => ({ ...prev, [product.id]: flash }))
          setTimeout(() => setPriceFlash(prev => { const n = { ...prev }; delete n[product.id]; return n }), 3000)
        }

        if (data.status === 'success') {
          setProducts(prev => prev.map(x =>
            x.id === product.id
              ? { ...x, my_price: data.new_price, last_competitor_price: minPrice, last_dump_at: new Date().toISOString() }
              : x
          ))
        } else {
          setProducts(prev => prev.map(x =>
            x.id === product.id ? { ...x, last_competitor_price: minPrice } : x
          ))
        }
      } catch (err) {
        log.push({ name: product.name, status: 'error', message: err.message || 'CORS/сеть' })
      }

      await new Promise(r => setTimeout(r, 1000))
    }

    setAutoLastRun(new Date())
    setAutoLog(log)
    setAutoRunning(false)
  }, [])

  async function addProduct(e) {
    e.preventDefault()
    try {
      await api.post('/products/', {
        ...form,
        store_id: Number(form.store_id),
        my_cost: Number(form.my_cost) || 0,
        my_price: Number(form.my_price) || 0,
        min_price: Number(form.min_price) || 0,
        stock: Number(form.stock) || 0,
        min_margin: Number(form.min_margin) || 500,
      })
      const { data } = await api.get('/products/')
      setProducts(data)
      setShowAdd(false)
      setForm(f => ({ ...f, name: '', sku: '', kaspi_url: '', my_cost: '', my_price: '', min_price: '', stock: '', notes: '' }))
    } catch (err) {
      alert(err.response?.data?.detail || 'Ошибка')
    }
  }

  async function deleteProduct(id) {
    if (!confirm('Удалить товар?')) return
    await api.delete(`/products/${id}`)
    setProducts(p => p.filter(x => x.id !== id))
  }

  async function toggleReprice(product) {
    await api.put(`/products/${product.id}`, { reprice_enabled: !product.reprice_enabled })
    setProducts(p => p.map(x => x.id === product.id ? { ...x, reprice_enabled: !x.reprice_enabled } : x))
  }

  async function updateField(id, field, value) {
    await api.put(`/products/${id}`, { [field]: value })
    setProducts(p => p.map(x => x.id === id ? { ...x, [field]: value } : x))
  }

  async function runRepricer() {
    setRunning(true)
    try {
      await api.post('/repricer/run')
      const { data } = await api.get('/products/')
      setProducts(data)
    } catch {
      alert('Ошибка запуска')
    } finally {
      setRunning(false)
    }
  }

  async function syncFromKaspi() {
    if (stores.length === 0) { alert('Сначала добавьте магазин в Профиле'); return }
    const storeId = stores[0].id
    setSyncing(true)
    setSyncResult(null)
    try {
      const { data } = await api.post(`/products/sync/${storeId}`)
      setSyncResult(data)
      const { data: prods } = await api.get('/products/')
      setProducts(prods)
    } catch (err) {
      alert(err.response?.data?.detail || 'Ошибка синхронизации')
    } finally {
      setSyncing(false)
    }
  }

  async function checkPosition(product, showModal = true) {
    if (!product.sku) return
    const masterSku = product.sku.split('_')[0]
    setCheckingPosition(prev => ({ ...prev, [product.id]: true }))
    try {
      // Fetch directly from browser (Kaspi blocks server IPs)
      const resp = await fetch(`https://kaspi.kz/yml/offer-view/offers/${masterSku}`, {
        headers: { 'Accept': 'application/json' },
      })
      if (!resp.ok) throw new Error(`Kaspi API: ${resp.status}`)
      const raw = await resp.json()

      const offers = raw.offers || []
      const total = raw.offersCount || raw.total || offers.length
      const competitors = offers.map((o, idx) => ({
        position: idx + 1,
        merchantId: o.merchantId || '',
        merchantName: o.merchantName || '',
        price: Math.round(o.price || 0),
        rating: o.merchantRating,
        reviewsCount: o.merchantReviewsQuantity || 0,
        kaspiDelivery: o.kaspiDelivery || false,
        deliveryDuration: o.deliveryDuration || '',
      }))

      // Find our store among competitors
      const storeIds = stores.map(s => String(s.seller_id))
      const ours = competitors.find(c => storeIds.includes(String(c.merchantId)))
      const position = ours?.position || null

      // Save to backend
      await api.post(`/products/${product.id}/save-position`, { position, total }).catch(() => {})

      setProducts(p => p.map(x => x.id === product.id
        ? { ...x, position, position_total: total }
        : x
      ))
      if (showModal) {
        setCompetitorModal({ product, competitors, position, total })
      }
    } catch (err) {
      // CORS or network error — fallback to backend
      try {
        const { data } = await api.post(`/products/${product.id}/check-position`)
        setProducts(p => p.map(x => x.id === product.id
          ? { ...x, position: data.position, position_total: data.total }
          : x
        ))
        if (showModal && data.competitors?.length > 0) {
          setCompetitorModal({ product, competitors: data.competitors, position: data.position, total: data.total })
        }
      } catch {}
    } finally {
      setCheckingPosition(prev => ({ ...prev, [product.id]: false }))
    }
  }

  async function checkAllPositions() {
    const toCheck = products.filter(p => p.kaspi_url)
    if (toCheck.length === 0) { alert('Нет товаров со ссылкой на Kaspi'); return }
    setCheckingAll(true)
    setCheckAllProgress({ done: 0, total: toCheck.length })
    for (let i = 0; i < toCheck.length; i++) {
      await checkPosition(toCheck[i], false)
      setCheckAllProgress({ done: i + 1, total: toCheck.length })
    }
    setCheckingAll(false)
    setCheckAllProgress(null)
  }

  async function massUpdatePreorder(days) {
    const d = Number(days)
    if (isNaN(d)) return
    await Promise.all(products.map(p => api.put(`/products/${p.id}`, { preorder_days: d })))
    setProducts(prev => prev.map(x => ({ ...x, preorder_days: d })))
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400">Загрузка...</div>

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Товары</h1>
          <p className="text-gray-400 mt-1">{products.length} товаров</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={syncFromKaspi}
            disabled={syncing}
            className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            {syncing ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
            {syncing ? 'Синхронизация...' : 'Импорт из Kaspi'}
          </button>
          <button
            onClick={checkAllPositions}
            disabled={checkingAll}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <MapPin size={16} />
            {checkingAll ? `Позиции ${checkAllProgress?.done}/${checkAllProgress?.total}` : 'Позиции'}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors text-sm"
          >
            <Plus size={18} /> Добавить товар
          </button>
        </div>
      </div>

      {syncResult && (
        <div className="mb-4 flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-sm">
          <span className="text-green-300">
            Импорт завершён: добавлено <strong>{syncResult.added}</strong>, обновлено <strong>{syncResult.updated}</strong> из {syncResult.total_from_kaspi} товаров Kaspi
            <span className="ml-2 text-gray-500 text-xs">({syncResult.source === 'api_token' ? 'API токен' : 'куки'})</span>
          </span>
          <button onClick={() => setSyncResult(null)} className="text-gray-500 hover:text-white ml-4">✕</button>
        </div>
      )}

      {/* Auto-reprice status bar */}
      {products.some(p => p.reprice_enabled) && (
        <div className="mb-4 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap size={14} className={autoRunning ? 'text-yellow-400 animate-pulse' : 'text-green-400'} />
              <span className="text-gray-200 font-medium">
                {autoRunning ? `Демпинг... (${autoLog.length}/${products.filter(p => p.reprice_enabled && p.sku).length})` : 'Авто-демпинг активен'}
              </span>
              {!autoRunning && (
                <span className="text-gray-500 text-xs">
                  через {Math.floor(countdown / 60000)}:{String(Math.floor((countdown % 60000) / 1000)).padStart(2, '0')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              {autoLog.length > 0 && !autoRunning && (
                <div className="flex items-center gap-3 text-xs">
                  {autoLog.filter(r => r.status === 'success').length > 0 && (
                    <span className="text-green-400">↓ {autoLog.filter(r => r.status === 'success').length} снижено</span>
                  )}
                  {autoLog.filter(r => r.status === 'already_lower').length > 0 && (
                    <span className="text-blue-400">= {autoLog.filter(r => r.status === 'already_lower').length} дешевле</span>
                  )}
                  {autoLog.filter(r => r.status === 'blocked').length > 0 && (
                    <span className="text-yellow-500">! {autoLog.filter(r => r.status === 'blocked').length} мин. цена</span>
                  )}
                  {autoLog.filter(r => r.status === 'error' || r.status === 'no_data').length > 0 && (
                    <span className="text-red-400">✕ {autoLog.filter(r => r.status === 'error' || r.status === 'no_data').length} ошибок</span>
                  )}
                  {autoLastRun && (
                    <span className="text-gray-600">{autoLastRun.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}</span>
                  )}
                </div>
              )}
              <button
                onClick={runAutoReprice}
                disabled={autoRunning}
                className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
              >
                {autoRunning ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                {autoRunning ? 'Работает...' : 'Запустить'}
              </button>
            </div>
          </div>

          {/* Error details if any */}
          {autoLog.some(r => r.status === 'error') && (
            <div className="mt-2 text-xs text-red-400/80 border-t border-gray-800 pt-2">
              {autoLog.filter(r => r.status === 'error').slice(0, 2).map((r, i) => (
                <span key={i} className="mr-3">{r.name}: {r.message}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Поиск по названию или SKU..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-red-500"
        />
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={addProduct} className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-4">
          <h3 className="font-semibold mb-4">Новый товар</h3>
          <div className="grid grid-cols-3 gap-3">
            {stores.length > 0 && (
              <div className="col-span-3">
                <select value={form.store_id} onChange={e => setForm({ ...form, store_id: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" required>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.seller_id}</option>)}
                </select>
              </div>
            )}
            <input className="col-span-3 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="Название товара *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="SKU" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
            <input className="col-span-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="URL на Kaspi" value={form.kaspi_url} onChange={e => setForm({ ...form, kaspi_url: e.target.value })} />
            <input type="number" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="Себестоимость ₸" value={form.my_cost} onChange={e => setForm({ ...form, my_cost: e.target.value })} />
            <input type="number" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="Текущая цена ₸" value={form.my_price} onChange={e => setForm({ ...form, my_price: e.target.value })} />
            <input type="number" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="Мин. цена ₸" value={form.min_price} onChange={e => setForm({ ...form, min_price: e.target.value })} />
            <input type="number" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="Остаток (шт)" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} />
            <input type="number" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="Мин. маржа ₸" value={form.min_margin} onChange={e => setForm({ ...form, min_margin: e.target.value })} />
            <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="Заметка" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex gap-2 mt-3">
            <button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm">Добавить</button>
            <button type="button" onClick={() => setShowAdd(false)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm">Отмена</button>
          </div>
        </form>
      )}

      {/* ДЕМПИНГ TAB */}
      {tab === 'Демпинг' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {products.length === 0 ? 'Добавьте первый товар' : 'Ничего не найдено'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs">
                    <th className="text-center px-3 py-3 w-10">Авто</th>
                    <th className="text-left px-4 py-3">Товар</th>
                    <th className="text-right px-4 py-3">Цена</th>
                    <th className="text-center px-4 py-3">Позиция</th>
                    <th className="text-right px-4 py-3">Мин. цена</th>
                    <th className="text-right px-4 py-3">Закуп</th>
                    <th className="text-right px-4 py-3">Конкурент</th>
                    <th className="px-4 py-3">Заметка</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => {
                    const winning = p.my_price && p.last_competitor_price && p.my_price <= p.last_competitor_price
                    return (
                      <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                        <td className="px-3 py-3 text-center">
                          <button onClick={() => toggleReprice(p)} title={p.reprice_enabled ? 'Выключить авто-демпинг' : 'Включить авто-демпинг'}>
                            {p.reprice_enabled
                              ? <ToggleRight size={22} className="text-green-400" />
                              : <ToggleLeft size={22} className="text-gray-600" />
                            }
                          </button>
                        </td>
                        <td className="px-4 py-3 max-w-[220px]">
                          <div className="flex items-start gap-1.5">
                            <div className="min-w-0">
                              {p.kaspi_url ? (
                                <a
                                  href={p.kaspi_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium truncate block hover:text-red-400 transition-colors"
                                  title={p.name}
                                >
                                  {p.name}
                                </a>
                              ) : (
                                <div className="font-medium truncate" title={p.name}>{p.name}</div>
                              )}
                              {p.sku && <div className="text-xs text-gray-500 truncate">{p.sku}</div>}
                            </div>
                            {p.kaspi_url && (
                              <a href={p.kaspi_url} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-red-400 mt-0.5 flex-shrink-0">
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className={`transition-colors duration-500 rounded px-1 ${
                            priceFlash[p.id] === 'success' ? 'bg-green-500/20' :
                            priceFlash[p.id] === 'blocked' ? 'bg-yellow-500/10' :
                            priceFlash[p.id] === 'lower' ? 'bg-blue-500/10' : ''
                          }`}>
                            <InlineEdit value={p.my_price || 0} onSave={v => updateField(p.id, 'my_price', Number(v))} format={v => `${Number(v).toLocaleString()}₸`} />
                            {p.last_dump_at && (() => {
                              const d = new Date(p.last_dump_at)
                              const today = new Date()
                              const isToday = d.toDateString() === today.toDateString()
                              return isToday ? (
                                <div className="text-xs text-green-500/70 mt-0.5">↓ {d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}</div>
                              ) : null
                            })()}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {p.position ? (
                            <button
                              onClick={() => checkPosition(p)}
                              disabled={checkingPosition[p.id]}
                              className="text-xs bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded transition-colors"
                              title="Обновить позицию"
                            >
                              {checkingPosition[p.id] ? (
                                <RefreshCw size={12} className="animate-spin inline" />
                              ) : (
                                <span className={p.position === 1 ? 'text-green-400' : p.position <= 3 ? 'text-yellow-400' : 'text-gray-300'}>
                                  {p.position} из {p.position_total || '?'}
                                </span>
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={() => checkPosition(p)}
                              disabled={checkingPosition[p.id] || !p.kaspi_url}
                              className="text-gray-600 hover:text-blue-400 transition-colors disabled:opacity-30"
                              title={p.kaspi_url ? 'Проверить позицию' : 'Нет ссылки на Kaspi'}
                            >
                              {checkingPosition[p.id]
                                ? <RefreshCw size={14} className="animate-spin" />
                                : <MapPin size={14} />
                              }
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <InlineEdit value={p.min_price || 0} onSave={v => updateField(p.id, 'min_price', Number(v))} format={v => `${Number(v).toLocaleString()}₸`} />
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400">
                          {p.my_cost ? `${p.my_cost.toLocaleString()}₸` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {p.last_competitor_price ? (
                            <span className={winning ? 'text-green-400' : 'text-red-400'}>
                              {p.last_competitor_price.toLocaleString()}₸
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 max-w-[140px]">
                          <InlineEdit value={p.notes || ''} onSave={v => updateField(p.id, 'notes', v)} format={v => v || <span className="text-gray-600 text-xs">добавить...</span>} isText />
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => deleteProduct(p.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Competitor modal */}
      {competitorModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setCompetitorModal(null)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="font-semibold truncate max-w-md">{competitorModal.product.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {competitorModal.position
                    ? <span className={`font-medium ${competitorModal.position === 1 ? 'text-green-400' : competitorModal.position <= 3 ? 'text-yellow-400' : 'text-gray-300'}`}>
                        Наша позиция: {competitorModal.position} из {competitorModal.total}
                      </span>
                    : <span className="text-gray-500">Наш магазин не найден в списке</span>
                  }
                </p>
              </div>
              <button onClick={() => setCompetitorModal(null)} className="text-gray-500 hover:text-white text-xl ml-4">✕</button>
            </div>
            <div className="overflow-y-auto max-h-[60vh]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs">
                    <th className="text-center px-4 py-2 w-10">#</th>
                    <th className="text-left px-4 py-2">Продавец</th>
                    <th className="text-right px-4 py-2">Цена</th>
                    <th className="text-center px-4 py-2">Доставка</th>
                    <th className="text-right px-4 py-2">Рейтинг</th>
                  </tr>
                </thead>
                <tbody>
                  {competitorModal.competitors.map(c => {
                    const isUs = c.position === competitorModal.position && competitorModal.position !== null
                    return (
                      <tr key={c.merchantId} className={`border-b border-gray-800/50 ${isUs ? 'bg-red-600/10' : 'hover:bg-gray-800/20'}`}>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-xs font-bold ${c.position === 1 ? 'text-green-400' : c.position <= 3 ? 'text-yellow-400' : 'text-gray-500'}`}>
                            {c.position}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className={`font-medium ${isUs ? 'text-red-400' : ''}`}>
                            {c.merchantName} {isUs && <span className="text-xs bg-red-600/20 text-red-400 px-1.5 py-0.5 rounded ml-1">мы</span>}
                          </div>
                          <div className="text-xs text-gray-500">{c.reviewsCount} отзывов</div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium">
                          {c.price.toLocaleString()}₸
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {c.kaspiDelivery
                            ? <span className="text-xs bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded">Kaspi</span>
                            : <span className="text-xs text-gray-600">—</span>
                          }
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-yellow-400">
                          {c.rating ? `★ ${c.rating}` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ПРЕДЗАКАЗ TAB */}
      {tab === 'Предзаказ' && (
        <div>
          <div className="flex items-center gap-3 mb-4 bg-gray-900 border border-gray-800 rounded-xl p-4">
            <span className="text-sm text-gray-400">Изменить дни доставки всем:</span>
            <input
              type="number"
              min="0"
              placeholder="Кол-во дней"
              className="w-28 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-red-500"
              onKeyDown={e => { if (e.key === 'Enter') massUpdatePreorder(e.target.value) }}
            />
            <span className="text-xs text-gray-500">Нажми Enter для применения ко всем</span>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-gray-500">Нет товаров</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs">
                    <th className="text-left px-4 py-3">Товар</th>
                    <th className="text-left px-4 py-3">SKU</th>
                    <th className="text-center px-4 py-3">Дней доставки</th>
                    <th className="text-center px-4 py-3">Авто-снижение</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                      <td className="px-4 py-3">
                        <div className="font-medium truncate max-w-[300px]">{p.name}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{p.sku || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={p.preorder_days || 0}
                          onChange={e => setProducts(prev => prev.map(x => x.id === p.id ? { ...x, preorder_days: Number(e.target.value) } : x))}
                          onBlur={e => updateField(p.id, 'preorder_days', Number(e.target.value))}
                          className="w-20 text-center bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-red-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => updateField(p.id, 'preorder_auto', !p.preorder_auto)}>
                          {p.preorder_auto
                            ? <ToggleRight size={24} className="text-green-400" />
                            : <ToggleLeft size={24} className="text-gray-600" />
                          }
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function InlineEdit({ value, onSave, format, isText = false }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)

  useEffect(() => setVal(value), [value])

  if (editing) {
    return (
      <input
        autoFocus
        type={isText ? 'text' : 'number'}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => { onSave(val); setEditing(false) }}
        onKeyDown={e => {
          if (e.key === 'Enter') { onSave(val); setEditing(false) }
          if (e.key === 'Escape') setEditing(false)
        }}
        className={`${isText ? 'w-32' : 'w-24'} text-right bg-gray-800 border border-red-500 rounded px-2 py-0.5 text-sm focus:outline-none`}
      />
    )
  }

  return (
    <span onClick={() => setEditing(true)} className="cursor-pointer hover:text-red-400 transition-colors" title="Нажмите для редактирования">
      {typeof format === 'function' ? format(val) : val}
    </span>
  )
}
