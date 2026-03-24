import { useState, useEffect } from 'react'
import { Star, Image, RefreshCw, ChevronDown } from 'lucide-react'
import api from '../api/client'

function StarRating({ rating, size = 14 }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={size}
          className={i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}
        />
      ))}
    </div>
  )
}

export default function Reviews() {
  const [products, setProducts] = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [reviews, setReviews] = useState([])
  const [summary, setSummary] = useState(null)
  const [groupSummary, setGroupSummary] = useState([])
  const [filter, setFilter] = useState('COMMENT')
  const [loading, setLoading] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [lightbox, setLightbox] = useState(null)

  useEffect(() => {
    api.get('/products/').then(({ data }) => {
      const withSku = data.filter(p => p.sku)
      setProducts(withSku)
      if (withSku.length > 0) setSelectedProduct(withSku[0])
    }).finally(() => setLoadingProducts(false))
  }, [])

  useEffect(() => {
    if (selectedProduct) loadReviews(selectedProduct.id, filter)
  }, [selectedProduct, filter])

  async function loadReviews(productId, filterType) {
    setLoading(true)
    setReviews([])
    setSummary(null)
    try {
      const { data } = await api.get(`/reviews/${productId}?filter_type=${filterType}&limit=20`)
      setReviews(data.reviews || [])
      setSummary(data.summary || null)
      setGroupSummary(data.group_summary || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const FILTERS = [
    { id: 'COMMENT', label: 'С отзывом' },
    { id: 'PICTURE', label: 'С фото' },
    { id: 'POSITIVE', label: 'Положительные' },
    { id: 'NEGATIVE', label: 'Отрицательные' },
    { id: 'ALL', label: 'Все' },
  ]

  const getTotal = (id) => (groupSummary.find(g => g.id === id) || {}).total || 0

  if (loadingProducts) return <div className="flex items-center justify-center h-full text-gray-400">Загрузка...</div>

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Отзывы</h1>
          <p className="text-gray-400 mt-1">Отзывы покупателей с Kaspi.kz</p>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
          Нет товаров с SKU. Сначала синхронизируйте товары из Kaspi.
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Sidebar: product list */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 text-xs text-gray-400 font-medium uppercase tracking-wider">
                Товары
              </div>
              <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
                {products.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProduct(p)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-800/50 text-sm transition-colors ${
                      selectedProduct?.id === p.id
                        ? 'bg-red-600/10 text-red-400 border-l-2 border-l-red-500'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">{p.sku}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {selectedProduct && (
              <>
                {/* Summary */}
                {summary && (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
                    <div className="flex items-start gap-6">
                      <div className="text-center">
                        <div className="text-5xl font-bold text-yellow-400">{summary.global?.toFixed(1)}</div>
                        <StarRating rating={Math.round(summary.global || 0)} size={16} />
                        <div className="text-xs text-gray-500 mt-1">{getTotal('ALL')} отзывов</div>
                      </div>
                      <div className="flex-1">
                        {(summary.statistic || []).map(s => (
                          <div key={s.rate} className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-gray-400 w-4">{s.rate}</span>
                            <Star size={12} className="text-yellow-400 fill-yellow-400" />
                            <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                              <div
                                className="bg-yellow-400 h-1.5 rounded-full"
                                style={{ width: `${getTotal('ALL') ? (s.count / getTotal('ALL')) * 100 : 0}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 w-6 text-right">{s.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Filters */}
                <div className="flex gap-2 mb-4 flex-wrap">
                  {FILTERS.map(f => (
                    <button
                      key={f.id}
                      onClick={() => setFilter(f.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        filter === f.id
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-900 border border-gray-700 text-gray-400 hover:text-white'
                      }`}
                    >
                      {f.label}
                      {groupSummary.length > 0 && (
                        <span className="ml-1 opacity-60">({getTotal(f.id)})</span>
                      )}
                    </button>
                  ))}
                  <button
                    onClick={() => loadReviews(selectedProduct.id, filter)}
                    className="ml-auto text-gray-500 hover:text-white transition-colors"
                    title="Обновить"
                  >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>

                {/* Reviews list */}
                {loading ? (
                  <div className="flex items-center justify-center py-16 text-gray-400">
                    <RefreshCw size={20} className="animate-spin mr-2" /> Загрузка отзывов...
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
                    Отзывов нет
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reviews.map(r => (
                      <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-red-600/20 flex items-center justify-center text-red-400 font-bold text-sm">
                                {r.author?.[0] || '?'}
                              </div>
                              <div>
                                <div className="font-medium text-sm">{r.author}</div>
                                <div className="text-xs text-gray-500">{r.date}</div>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <StarRating rating={r.rating} />
                            {r.merchant && (
                              <div className="text-xs text-gray-500 mt-1">через: {r.merchant.name}</div>
                            )}
                          </div>
                        </div>

                        {r.comment?.text && (
                          <p className="text-sm text-gray-200 leading-relaxed mb-3">{r.comment.text}</p>
                        )}
                        {r.comment?.plus && (
                          <p className="text-xs text-green-400 mb-1">+ {r.comment.plus}</p>
                        )}
                        {r.comment?.minus && (
                          <p className="text-xs text-red-400 mb-1">− {r.comment.minus}</p>
                        )}

                        {r.galleryImages?.length > 0 && (
                          <div className="flex gap-2 mt-3 flex-wrap">
                            {r.galleryImages.map(img => (
                              <button
                                key={img.id}
                                onClick={() => setLightbox(img.large)}
                                className="relative group"
                              >
                                <img
                                  src={img.small}
                                  alt=""
                                  className="w-16 h-16 object-cover rounded-lg border border-gray-700 group-hover:border-red-500 transition-colors"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                  <Image size={14} className="text-white" />
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>
      )}
    </div>
  )
}
