import { useState, useEffect, useRef } from 'react'
import { Plus, Printer, Trash2, RefreshCw, Download, Zap } from 'lucide-react'
import api from '../api/client'

const AUTO_SYNC_MS = 5 * 60 * 1000

const STATUSES = {
  new: { label: 'Новый', color: 'bg-blue-500/10 text-blue-400' },
  confirmed: { label: 'Принят', color: 'bg-yellow-500/10 text-yellow-400' },
  shipped: { label: 'В доставке', color: 'bg-orange-500/10 text-orange-400' },
  done: { label: 'Выполнен', color: 'bg-green-500/10 text-green-400' },
  cancelled: { label: 'Отменён', color: 'bg-red-500/10 text-red-400' },
}

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState([])
  const [filterStatus, setFilterStatus] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [autoSyncLastRun, setAutoSyncLastRun] = useState(null)
  const autoSyncingRef = useRef(false)
  const [form, setForm] = useState({
    kaspi_order_id: '', customer_name: '', customer_phone: '',
    product_name: '', product_sku: '', quantity: 1,
    price: '', total_price: '', status: 'new',
    delivery_type: '', address: '', note: ''
  })

  useEffect(() => { loadOrders() }, [filterStatus])

  // Auto-sync orders every 5 min
  useEffect(() => {
    const timer = setInterval(async () => {
      if (autoSyncingRef.current) return
      autoSyncingRef.current = true
      try {
        await api.post('/orders/sync-kaspi')
        const url = filterStatus ? `/orders/?status=${filterStatus}` : '/orders/'
        const { data } = await api.get(url)
        setOrders(data)
        setAutoSyncLastRun(new Date())
      } catch {}
      finally { autoSyncingRef.current = false }
    }, AUTO_SYNC_MS)
    return () => clearInterval(timer)
  }, [filterStatus])

  async function loadOrders() {
    setLoading(true)
    const url = filterStatus ? `/orders/?status=${filterStatus}` : '/orders/'
    const { data } = await api.get(url)
    setOrders(data)
    setLoading(false)
  }

  async function addOrder(e) {
    e.preventDefault()
    try {
      const { data } = await api.post('/orders/', {
        ...form,
        quantity: Number(form.quantity) || 1,
        price: Number(form.price) || 0,
        total_price: Number(form.total_price) || Number(form.price) * Number(form.quantity) || 0,
      })
      setOrders(prev => [data, ...prev])
      setShowAdd(false)
      setForm({ kaspi_order_id: '', customer_name: '', customer_phone: '', product_name: '', product_sku: '', quantity: 1, price: '', total_price: '', status: 'new', delivery_type: '', address: '', note: '' })
    } catch (err) {
      alert(err.response?.data?.detail || 'Ошибка')
    }
  }

  async function updateStatus(id, status) {
    await api.put(`/orders/${id}`, { status })
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
  }

  async function deleteOrder(id) {
    if (!confirm('Удалить заказ?')) return
    await api.delete(`/orders/${id}`)
    setOrders(prev => prev.filter(o => o.id !== id))
    setSelected(prev => prev.filter(s => s !== id))
  }

  function toggleSelect(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  async function syncFromKaspi() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const { data } = await api.post('/orders/sync-kaspi')
      setSyncResult(data)
      await loadOrders()
    } catch (err) {
      alert(err.response?.data?.detail || 'Ошибка синхронизации')
    } finally {
      setSyncing(false)
    }
  }

  function printInvoices() {
    const toPrint = selected.length > 0
      ? orders.filter(o => selected.includes(o.id))
      : orders

    const html = `
      <html><head><title>Накладные</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; }
        .invoice { border: 1px solid #000; padding: 16px; margin-bottom: 20px; page-break-inside: avoid; }
        h3 { margin: 0 0 8px; font-size: 14px; }
        .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
        .label { color: #666; }
        hr { border: none; border-top: 1px solid #ccc; margin: 8px 0; }
      </style></head>
      <body>
        ${toPrint.map(o => `
          <div class="invoice">
            <h3>Накладная #${o.kaspi_order_id || o.id}</h3>
            <hr/>
            <div class="row"><span class="label">Покупатель:</span><span>${o.customer_name || '—'}</span></div>
            <div class="row"><span class="label">Телефон:</span><span>${o.customer_phone || '—'}</span></div>
            <div class="row"><span class="label">Товар:</span><span>${o.product_name}</span></div>
            <div class="row"><span class="label">SKU:</span><span>${o.product_sku || '—'}</span></div>
            <div class="row"><span class="label">Кол-во:</span><span>${o.quantity} шт.</span></div>
            <div class="row"><span class="label">Сумма:</span><span>${(o.total_price || o.price * o.quantity || 0).toLocaleString()} ₸</span></div>
            <div class="row"><span class="label">Адрес:</span><span>${o.address || '—'}</span></div>
            <div class="row"><span class="label">Дата:</span><span>${new Date(o.created_at).toLocaleString('ru')}</span></div>
            ${o.note ? `<div class="row"><span class="label">Заметка:</span><span>${o.note}</span></div>` : ''}
          </div>
        `).join('')}
      </body></html>
    `
    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.print()
  }

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400">Загрузка...</div>

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Заказы</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-gray-400">{orders.length} заказов</p>
            <span className="flex items-center gap-1 text-xs text-green-500/70">
              <Zap size={11} /> авто-синк 5 мин
              {autoSyncLastRun && <span className="text-gray-600">· {autoSyncLastRun.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}</span>}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={syncFromKaspi}
            disabled={syncing}
            className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            {syncing ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
            {syncing ? 'Загрузка...' : 'Синк из Kaspi'}
          </button>
          <button
            onClick={printInvoices}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <Printer size={16} />
            {selected.length > 0 ? `Накладные (${selected.length})` : 'Накладные'}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors text-sm"
          >
            <Plus size={18} /> Добавить
          </button>
        </div>
      </div>

      {syncResult && (
        <div className="mb-4 flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-sm">
          <span className="text-green-300">
            Синк завершён: добавлено <strong>{syncResult.added}</strong>, обновлено <strong>{syncResult.updated}</strong> из {syncResult.total_from_kaspi} заказов
          </span>
          <button onClick={() => setSyncResult(null)} className="text-gray-500 hover:text-white ml-4">✕</button>
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setFilterStatus('')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === '' ? 'bg-gray-700 text-white' : 'bg-gray-900 border border-gray-700 text-gray-400 hover:text-white'}`}>
          Все
        </button>
        {Object.entries(STATUSES).map(([key, { label, color }]) => (
          <button key={key} onClick={() => setFilterStatus(key)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === key ? 'bg-gray-700 text-white' : 'bg-gray-900 border border-gray-700 text-gray-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={addOrder} className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-4">
          <h3 className="font-semibold mb-4">Новый заказ</h3>
          <div className="grid grid-cols-3 gap-3">
            <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="ID заказа Kaspi" value={form.kaspi_order_id} onChange={e => setForm({ ...form, kaspi_order_id: e.target.value })} />
            <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="Имя покупателя" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} />
            <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="Телефон" value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} />
            <input className="col-span-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="Название товара *" value={form.product_name} onChange={e => setForm({ ...form, product_name: e.target.value })} required />
            <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="SKU" value={form.product_sku} onChange={e => setForm({ ...form, product_sku: e.target.value })} />
            <input type="number" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="Кол-во" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} min="1" />
            <input type="number" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="Цена ₸" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
            <input className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="Тип доставки" value={form.delivery_type} onChange={e => setForm({ ...form, delivery_type: e.target.value })} />
            <input className="col-span-3 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="Адрес доставки" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            <input className="col-span-3 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="Заметка" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
          </div>
          <div className="flex gap-2 mt-3">
            <button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm">Добавить</button>
            <button type="button" onClick={() => setShowAdd(false)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm">Отмена</button>
          </div>
        </form>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {orders.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Нет заказов</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs">
                <th className="px-4 py-3 w-8">
                  <input type="checkbox" onChange={e => setSelected(e.target.checked ? orders.map(o => o.id) : [])} checked={selected.length === orders.length && orders.length > 0} className="rounded" />
                </th>
                <th className="text-left px-4 py-3">Заказ</th>
                <th className="text-left px-4 py-3">Покупатель</th>
                <th className="text-left px-4 py-3">Товар</th>
                <th className="text-right px-4 py-3">Сумма</th>
                <th className="text-center px-4 py-3">Статус</th>
                <th className="text-left px-4 py-3">Дата</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggleSelect(o.id)} className="rounded" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium font-mono text-xs">{o.kaspi_order_id || `#${o.id}`}</div>
                    {o.note && <div className="text-xs text-blue-400 mt-0.5">{o.note}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div>{o.customer_name || '—'}</div>
                    {o.address && <div className="text-xs text-gray-500 max-w-[180px] truncate mt-0.5">{o.address}</div>}
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <div className="truncate">{o.product_name}</div>
                    <div className="text-xs text-gray-500">{o.quantity} шт. {o.product_sku ? `· ${o.product_sku}` : ''}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {(o.total_price || 0).toLocaleString()}₸
                  </td>
                  <td className="px-4 py-3 text-center">
                    <select
                      value={o.status}
                      onChange={e => updateStatus(o.id, e.target.value)}
                      className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none ${STATUSES[o.status]?.color || 'bg-gray-700 text-gray-400'}`}
                    >
                      {Object.entries(STATUSES).map(([key, { label }]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(o.created_at).toLocaleDateString('ru')}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => deleteOrder(o.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
