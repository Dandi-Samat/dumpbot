import { useState, useEffect } from 'react'
import { Save, TrendingDown, Shield, Info } from 'lucide-react'
import api from '../api/client'

export default function Settings() {
  const [form, setForm] = useState({ reprice_step: 1, default_min_margin: 500 })
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.get('/settings/').then(({ data }) => {
      setForm({ reprice_step: data.reprice_step, default_min_margin: data.default_min_margin })
    }).finally(() => setLoading(false))
  }, [])

  async function save(e) {
    e.preventDefault()
    await api.put('/settings/', {
      reprice_step: Number(form.reprice_step),
      default_min_margin: Number(form.default_min_margin),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400">Загрузка...</div>

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Настройки</h1>
        <p className="text-gray-400 mt-1">Конфигурация демпинга и лимитов цен</p>
      </div>

      <form onSubmit={save} className="space-y-6">
        {/* Demping settings */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingDown size={18} className="text-red-400" />
            <h2 className="font-semibold">Настройки демпинга</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Шаг снижения цены (₸)
                <span className="ml-2 text-xs text-gray-600">— на сколько тенге снизить цену ниже конкурента</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.reprice_step}
                onChange={e => setForm({ ...form, reprice_step: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-red-500"
              />
              <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                <Info size={12} />
                Например: шаг = 1 → цена конкурента 10000₸, ваша цена станет 9999₸
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Минимальная маржа по умолчанию (₸)
                <span className="ml-2 text-xs text-gray-600">— применяется к новым товарам</span>
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={form.default_min_margin}
                onChange={e => setForm({ ...form, default_min_margin: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-red-500"
              />
              <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                <Info size={12} />
                Если цена падает ниже (себестоимость + маржа), демпинг блокируется
              </p>
            </div>
          </div>
        </div>

        {/* Protection */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={18} className="text-yellow-400" />
            <h2 className="font-semibold">Защита от убытков</h2>
          </div>
          <div className="text-sm text-gray-400 space-y-2">
            <p>Система автоматически защищает от торговли в минус:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-500">
              <li>Минимальная цена = себестоимость + минимальная маржа</li>
              <li>Если конкурент дешевле минимума — цена НЕ снижается</li>
              <li>Для каждого товара можно задать свою мин. цену в разделе «Товары»</li>
            </ul>
          </div>
        </div>

        <button
          type="submit"
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${
            saved ? 'bg-green-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
        >
          <Save size={16} />
          {saved ? 'Сохранено!' : 'Сохранить'}
        </button>
      </form>
    </div>
  )
}
