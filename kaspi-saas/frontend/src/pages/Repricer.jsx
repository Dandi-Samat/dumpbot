import { useState, useEffect } from 'react'
import { Play, RefreshCw, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react'
import api from '../api/client'

const STATUS_ICONS = {
  success: <CheckCircle size={16} className="text-green-400" />,
  already_lower: <CheckCircle size={16} className="text-blue-400" />,
  blocked: <AlertCircle size={16} className="text-yellow-400" />,
  no_sku: <AlertCircle size={16} className="text-orange-400" />,
  no_prices: <AlertCircle size={16} className="text-gray-400" />,
  error: <XCircle size={16} className="text-red-400" />,
}

const STATUS_LABELS = {
  success: 'Снижена',
  already_lower: 'Уже дешевле',
  blocked: 'Заблокировано',
  no_sku: 'Нет SKU',
  no_prices: 'Нет цен',
  error: 'Ошибка',
}

export default function Repricer() {
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState([])
  const [history, setHistory] = useState([])

  useEffect(() => {
    api.get('/repricer/history?limit=20').then(r => setHistory(r.data))
  }, [])

  async function runAll() {
    setRunning(true)
    setResults([])
    try {
      const { data } = await api.post('/repricer/run')
      setResults(data.results || [])
      // Refresh history
      const h = await api.get('/repricer/history?limit=20')
      setHistory(h.data)
    } catch (err) {
      setResults([{ status: 'error', message: err.response?.data?.detail || 'Ошибка', product: '?' }])
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Репрайсер</h1>
          <p className="text-gray-400 mt-1">Автоматическое снижение цен ниже конкурентов</p>
        </div>
        <button
          onClick={runAll}
          disabled={running}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-medium transition-colors"
        >
          {running ? <RefreshCw size={18} className="animate-spin" /> : <Play size={18} />}
          {running ? 'Запуск...' : 'Запустить демпинг'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
          <h2 className="font-semibold mb-4">Результаты последнего запуска</h2>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg">
                <div className="mt-0.5">{STATUS_ICONS[r.status] || STATUS_ICONS.error}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{r.product}</span>
                    <span className="text-xs text-gray-500 shrink-0">
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{r.message}</p>
                </div>
                {r.new_price && (
                  <div className="text-right shrink-0">
                    <span className="text-green-400 font-medium text-sm">{r.new_price.toLocaleString()}₸</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Clock size={18} className="text-gray-400" />
          История изменений
        </h2>
        {history.length === 0 ? (
          <p className="text-gray-500 text-sm">Пока нет истории. Запустите репрайсер.</p>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0">
                <div>{STATUS_ICONS[h.action] || STATUS_ICONS.error}</div>
                <div className="flex-1 text-sm">
                  <span className="text-gray-300">
                    Конкурент: {h.competitor_price?.toLocaleString()}₸
                  </span>
                  <span className="text-gray-500 mx-2">→</span>
                  <span className="text-white font-medium">{h.my_price?.toLocaleString()}₸</span>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(h.created_at).toLocaleString('ru')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
