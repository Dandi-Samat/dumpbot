import { useState, useEffect } from 'react'
import { Plus, Phone, Package, ChevronDown } from 'lucide-react'
import api from '../api/client'

const STATUS_STYLES = {
  new: 'bg-blue-500/20 text-blue-400',
  confirmed: 'bg-yellow-500/20 text-yellow-400',
  shipped: 'bg-orange-500/20 text-orange-400',
  done: 'bg-green-500/20 text-green-400',
  cancelled: 'bg-gray-500/20 text-gray-400',
}
const STATUS_LABELS = {
  new: 'Новый', confirmed: 'Подтверждён',
  shipped: 'Отправлен', done: 'Выполнен', cancelled: 'Отменён'
}

export default function Preorders() {
  const [orders, setOrders] = useState([])
  const [stores, setStores] = useState([])
  const [filterStatus, setFilterStatus] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    store_id: '', customer_name: '', customer_phone: '',
    product_name: '', product_sku: '', quantity: '1', price: '', note: ''
  })

  useEffect(() => {
    loadOrders()
    api.get('/stores/').then(r => {
      setStores(r.data)
      if (r.data.length > 0) setForm(f => ({ ...f, store_id: r.data[0].id }))
    })
  }, [filterStatus])

  async function loadOrders() {
    const params = filterStatus ? `?status=${filterStatus}` : ''
    const { data } = await api.get(`/preorders/${params}`)
    setOrders(data)
  }

  async function addOrder(e) {
    e.preventDefault()
    try {
      await api.post('/preorders/', {
        ...form,
        store_id: Number(form.store_id),
        quantity: Number(form.quantity),
        price: Number(form.price),
      })
      await loadOrders()
      setShowAdd(false)
    } catch (err) {
      alert(err.response?.data?.detail || 'Ошибка')
    }
  }

  async function updateStatus(id, status) {
    await api.put(`/preorders/${id}`, { status })
    setOrders(o => o.map(x => x.id === id ? { ...x, status } : x))
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Предзаказы</h1>
          <p className="text-gray-400 mt-1">{orders.length} заказов</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-medium"
        >
          <Plus size={18} /> Новый предзаказ
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {['', 'new', 'confirmed', 'shipped', 'done', 'cancelled'].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filterStatus === s ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {s ? STATUS_LABELS[s] : 'Все'}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={addOrder} className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-4">
          <h3 className="font-semibold mb-4">Новый предзаказ</h3>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.store_id}
              onChange={e => setForm({ ...form, store_id: e.target.value })}
              className="col-span-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
              required
            >
              {stores.map(s => <option key={s.id} value={s.id}>{s.seller_id}</option>)}
            </select>
            {[
              { key: 'customer_name', placeholder: 'Имя клиента *' },
              { key: 'customer_phone', placeholder: 'Телефон *' },
              { key: 'product_name', placeholder: 'Название товара *', span: 2 },
              { key: 'product_sku', placeholder: 'SKU (необязательно)' },
              { key: 'quantity', placeholder: 'Количество', type: 'number' },
              { key: 'price', placeholder: 'Цена ₸ *', type: 'number' },
              { key: 'note', placeholder: 'Примечание', span: 2 },
            ].map(({ key, placeholder, span, type = 'text' }) => (
              <input
                key={key}
                type={type}
                placeholder={placeholder}
                value={form[key]}
                onChange={e => setForm({ ...form, [key]: e.target.value })}
                required={['customer_name', 'customer_phone', 'product_name', 'price'].includes(key)}
                className={`${span === 2 ? 'col-span-2' : ''} bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500`}
              />
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm">
              Создать
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm">
              Отмена
            </button>
          </div>
        </form>
      )}

      {/* Orders list */}
      <div className="space-y-3">
        {orders.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
            Нет предзаказов
          </div>
        ) : orders.map(o => (
          <div key={o.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[o.status]}`}>
                    {STATUS_LABELS[o.status]}
                  </span>
                  <span className="text-xs text-gray-500">
                    #{o.id} · {new Date(o.created_at).toLocaleDateString('ru')}
                  </span>
                </div>
                <div className="font-medium">{o.product_name}</div>
                {o.product_sku && <div className="text-xs text-gray-500">{o.product_sku}</div>}
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                  <span className="flex items-center gap-1"><Phone size={12} /> {o.customer_phone}</span>
                  <span>{o.customer_name}</span>
                  <span className="flex items-center gap-1"><Package size={12} /> {o.quantity} шт.</span>
                </div>
                {o.note && <div className="text-xs text-gray-500 mt-1">{o.note}</div>}
              </div>
              <div className="text-right ml-4">
                <div className="text-lg font-bold">{o.total?.toLocaleString()}₸</div>
                <div className="text-xs text-gray-500">{o.price?.toLocaleString()}₸ × {o.quantity}</div>

                <select
                  value={o.status}
                  onChange={e => updateStatus(o.id, e.target.value)}
                  className="mt-2 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs focus:outline-none"
                >
                  {Object.entries(STATUS_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
