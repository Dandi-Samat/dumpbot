import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import api from '../api/client'

export default function Analytics() {
  const [topProducts, setTopProducts] = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/analytics/top-products').then(r => {
      setTopProducts(r.data)
      if (r.data.length > 0) {
        selectProduct(r.data[0].id)
      }
    }).finally(() => setLoading(false))
  }, [])

  async function selectProduct(id) {
    setSelectedProduct(id)
    const { data } = await api.get(`/analytics/price-history?product_id=${id}`)
    setChartData(data.map(d => ({
      date: new Date(d.date).toLocaleDateString('ru'),
      'Моя цена': d.my_price,
      'Конкурент': d.competitor_price,
    })))
  }

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400">Загрузка...</div>

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Аналитика</h1>
      <p className="text-gray-400 mb-8">История цен и активность репрайсера</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top products */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-semibold mb-4">Топ товаров</h2>
          {topProducts.length === 0 ? (
            <p className="text-gray-500 text-sm">Нет данных</p>
          ) : (
            <div className="space-y-2">
              {topProducts.map(p => (
                <button
                  key={p.id}
                  onClick={() => selectProduct(p.id)}
                  className={`w-full text-left p-3 rounded-lg text-sm transition-colors ${
                    selectedProduct === p.id ? 'bg-red-600/20 border border-red-600/40' : 'hover:bg-gray-800'
                  }`}
                >
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="flex justify-between mt-1 text-xs text-gray-400">
                    <span>Снижений: {p.lowered_count}</span>
                    <span>{p.my_price?.toLocaleString() || '—'}₸</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chart */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-semibold mb-4">История цен</h2>
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
              Выберите товар для просмотра графика
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 11 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#9ca3af' }}
                />
                <Legend />
                <Line type="monotone" dataKey="Моя цена" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Конкурент" stroke="#6b7280" strokeWidth={2} dot={false} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
