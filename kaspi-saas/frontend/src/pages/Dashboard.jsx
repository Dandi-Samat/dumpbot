import { useEffect, useState } from 'react'
import { Package, TrendingDown, TrendingUp, BarChart2, ShoppingCart, DollarSign } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import api from '../api/client'

function StatCard({ label, value, sub, icon: Icon, color = 'gray' }) {
  const colors = {
    red: 'bg-red-500/10 text-red-400',
    green: 'bg-green-500/10 text-green-400',
    blue: 'bg-blue-500/10 text-blue-400',
    yellow: 'bg-yellow-500/10 text-yellow-400',
    gray: 'bg-gray-500/10 text-gray-400',
  }
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [products, setProducts] = useState([])
  const [priceHistory, setPriceHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/analytics/summary'),
      api.get('/products/'),
      api.get('/repricer/history?limit=30'),
    ]).then(([s, p, h]) => {
      setSummary(s.data)
      setProducts(p.data)
      const grouped = {}
      h.data.forEach(item => {
        const date = new Date(item.created_at).toLocaleDateString('ru', { day: '2-digit', month: '2-digit' })
        if (!grouped[date]) grouped[date] = { date, снижений: 0 }
        if (item.action === 'lowered' || item.action === 'success') grouped[date].снижений++
      })
      setPriceHistory(Object.values(grouped).slice(-7))
    }).finally(() => setLoading(false))
  }, [])

  const topProducts = [...products].sort((a, b) => (b.my_price || 0) - (a.my_price || 0)).slice(0, 5)
  const winning = products.filter(p => p.my_price && p.last_competitor_price && p.my_price <= p.last_competitor_price).length
  const losing = products.filter(p => p.my_price && p.last_competitor_price && p.my_price > p.last_competitor_price).length

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-gray-400">Загрузка...</div>
    </div>
  )

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Главная</h1>
        <p className="text-gray-400 mt-1">Аналитика и обзор магазина</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <StatCard label="Заказов всего" value={summary?.orders?.total ?? 0} sub={`Новых: ${summary?.orders?.new ?? 0} · Сегодня: ${summary?.orders?.today ?? 0}`} icon={ShoppingCart} color="blue" />
        <StatCard label="Выручка (не отменённые)" value={`${(summary?.orders?.revenue ?? 0).toLocaleString('ru')} ₸`} sub="По всем заказам" icon={DollarSign} color="green" />
        <StatCard label="Снижено цен" value={summary?.repricer?.total_lowered ?? 0} sub={`Заблокировано: ${summary?.repricer?.total_blocked ?? 0}`} icon={BarChart2} color="yellow" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard label="Всего товаров" value={products.length} sub={`Авто-демпинг: ${products.filter(p => p.reprice_enabled).length}`} icon={Package} color="gray" />
        <StatCard label="Побеждаем в цене" value={winning} sub="Дешевле конкурентов" icon={TrendingDown} color="green" />
        <StatCard label="Проигрываем" value={losing} sub="Дороже конкурентов" icon={TrendingUp} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-semibold mb-4 text-sm text-gray-300">Снижения цен (последние 7 дней)</h2>
          {priceHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={priceHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                <Line type="monotone" dataKey="снижений" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-gray-500 text-sm">
              Нет данных — запустите репрайсер в разделе «Товары»
            </div>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-semibold mb-4 text-sm text-gray-300">Статус репрайсера</h2>
          <div className="space-y-1">
            {[
              { label: 'Всего снижено', value: summary?.repricer?.total_lowered ?? 0, color: 'text-green-400' },
              { label: 'Заблокировано (мин. маржа)', value: summary?.repricer?.total_blocked ?? 0, color: 'text-yellow-400' },
              { label: 'Товаров с демпингом', value: products.filter(p => p.reprice_enabled).length, color: 'text-blue-400' },
              { label: 'Без SKU (не работает)', value: products.filter(p => !p.sku).length, color: 'text-red-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
                <span className="text-sm text-gray-400">{label}</span>
                <span className={`font-medium ${color}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="font-semibold mb-4 text-sm text-gray-300">Топ товаров</h2>
        {topProducts.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">Добавьте товары в разделе «Товары»</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800">
                <th className="text-left py-2 font-normal">#</th>
                <th className="text-left py-2 font-normal">Товар</th>
                <th className="text-right py-2 font-normal">Моя цена</th>
                <th className="text-right py-2 font-normal">Конкурент</th>
                <th className="text-right py-2 font-normal">Позиция</th>
                <th className="text-center py-2 font-normal">Статус</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p, i) => {
                const win = p.my_price && p.last_competitor_price && p.my_price <= p.last_competitor_price
                return (
                  <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-3 text-gray-500">{i + 1}</td>
                    <td className="py-3">
                      <div className="font-medium truncate max-w-xs">{p.name}</div>
                      {p.sku && <div className="text-xs text-gray-500">{p.sku}</div>}
                    </td>
                    <td className="py-3 text-right font-medium">{p.my_price?.toLocaleString() || '—'}₸</td>
                    <td className="py-3 text-right text-gray-400">{p.last_competitor_price?.toLocaleString() || '—'}₸</td>
                    <td className="py-3 text-right text-gray-400">
                      {p.position ? `${p.position} из ${p.position_total || '?'}` : '—'}
                    </td>
                    <td className="py-3 text-center">
                      {p.last_competitor_price ? (
                        <span className={`text-xs px-2 py-1 rounded-full ${win ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                          {win ? 'Побеждаем' : 'Проигрываем'}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-400">Нет данных</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
