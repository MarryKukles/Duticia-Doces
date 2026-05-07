'use client'

import Image from 'next/image'
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
} from 'react'

import { db, storage } from '@/lib/firebase'

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from 'firebase/firestore'

import {
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage'

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function classNames(
  ...s: (string | false | null | undefined)[]
) {
  return s.filter(Boolean).join(' ')
}

function ratingToStars(rating: number) {
  const r = Number(rating) || 0
  const stars = r / 2
  return Math.min(5, Math.max(0, stars))
}

function normalizeToHalf(stars: number) {
  return Math.round(stars * 2) / 2
}

function Star({
  filled,
  half,
  size = 20,
}: {
  filled?: boolean
  half?: boolean
  size?: number
}) {
  const gid = useId()

  if (half) {
    const gradId = `half-gradient-${gid}`

    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        className="transition-all"
        strokeWidth={1.5}
      >
        <defs>
          <linearGradient
            id={gradId}
            x1="0"
            x2="100%"
            y1="0"
            y2="0"
          >
            <stop offset="50%" stopColor="#facc15" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>

        <path
          d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
          fill={`url(#${gradId})`}
          stroke="#fbbf24"
        />
      </svg>
    )
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={classNames(
        'transition-all',
        filled
          ? 'fill-yellow-400 stroke-yellow-500'
          : 'fill-transparent stroke-gray-300'
      )}
      strokeWidth={1.5}
    >
      <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  )
}

function Stars({
  rating,
  size = 20,
}: {
  rating: number
  size?: number
}) {
  const exact = ratingToStars(rating)

  const stars = normalizeToHalf(exact)

  const full = Math.floor(stars)

  const half = stars - full === 0.5

  const label = Number.isInteger(stars)
    ? String(stars)
    : stars.toFixed(1)

  return (
    <div
      className="flex items-center gap-1"
      aria-label={`Avaliação: ${label} de 5 estrelas`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          filled={i < full}
          half={i === full && half}
        />
      ))}
    </div>
  )
}

export type Doce = {
  id: string
  created_at?: string
  nome: string
  data: string
  valor: number
  foto?: string | null
  comentario?: string | null
  nota: number
}

export default function Page() {
  const [doces, setDoces] = useState<Doce[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editandoId, setEditandoId] =
    useState<string | null>(null)

  const [filtro, setFiltro] = useState('')

  const fileRef =
    useRef<HTMLInputElement | null>(null)

  const [form, setForm] = useState({
    nome: '',
    data: new Date().toISOString().slice(0, 10),
    valor: '',
    foto: '',
    comentario: '',
    nota: 0 as number | string,
  })

  async function refreshDoces() {
    const querySnapshot = await getDocs(
      collection(db, 'doces')
    )

    const lista: any[] = []

    querySnapshot.forEach((docItem) => {
      lista.push({
        id: docItem.id,
        ...docItem.data(),
      })
    })

    lista.sort((a, b) =>
      a.data < b.data ? 1 : -1
    )

    setDoces(lista)

    setLoading(false)
  }

  useEffect(() => {
    refreshDoces()
  }, [])

  function limparFormulario() {
    setForm({
      nome: '',
      data: new Date().toISOString().slice(0, 10),
      valor: '',
      foto: '',
      comentario: '',
      nota: 0,
    })

    setEditandoId(null)

    if (fileRef.current) {
      fileRef.current.value = ''
    }
  }

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement
    >
  ) {
    const { name, value } = e.target

    setForm((f) => ({
      ...f,
      [name]: value,
    }))
  }

  async function handleFotoChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0]

    if (!file) return

    try {
      const storageRef = ref(
        storage,
        `doces/${Date.now()}-${file.name}`
      )

      await uploadBytes(storageRef, file)

      const url = await getDownloadURL(
        storageRef
      )

      setForm((f) => ({
        ...f,
        foto: url,
      }))
    } catch (error: any) {
      console.error(error)

      alert(
        'Falha ao enviar foto: ' + error.message
      )
    }
  }

  function validar() {
    if (!form.nome.trim())
      return 'Informe o nome do doce.'

    if (!form.data)
      return 'Informe a data que experimentaram.'

    const valorNum = Number(
      String(form.valor).replace(',', '.')
    )

    if (isNaN(valorNum) || valorNum < 0)
      return 'Valor pago inválido.'

    const notaNum = Number(form.nota)

    if (
      isNaN(notaNum) ||
      notaNum < 0 ||
      notaNum > 10
    )
      return 'A nota deve ser entre 0 e 10.'

    return null
  }

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault()

    if (saving) return

    const err = validar()

    if (err) return alert(err)

    setSaving(true)

    const payload = {
      nome: form.nome.trim(),
      data: form.data,
      valor: Number(
        String(form.valor).replace(',', '.')
      ),
      foto: form.foto || null,
      comentario: form.comentario?.trim() || null,
      nota: Number(form.nota),
    }

    try {
      if (editandoId) {
        await updateDoc(
          doc(db, 'doces', editandoId),
          payload
        )
      } else {
        await addDoc(
          collection(db, 'doces'),
          payload
        )
      }

      await refreshDoces()

      limparFormulario()

      alert('Prontinho! Doce salvo com sucesso.')
    } catch (e: any) {
      console.error(e)

      alert(
        'Erro ao salvar: ' + (e?.message || e)
      )
    } finally {
      setSaving(false)
    }
  }

  async function editar(id: string) {
    const d = doces.find((x) => x.id === id)

    if (!d) return

    setEditandoId(id)

    setForm({
      nome: d.nome,
      data: d.data,
      valor: String(d.valor),
      foto: d.foto || '',
      comentario: d.comentario || '',
      nota: d.nota,
    })

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  async function excluir(id: string) {
    if (
      !confirm(
        'Tem certeza que deseja excluir este doce?'
      )
    )
      return

    await deleteDoc(doc(db, 'doces', id))

    refreshDoces()
  }

  const docesFiltrados = useMemo(() => {
    const termo = filtro.trim().toLowerCase()

    const base = termo
      ? doces.filter((d) =>
          [
            d.nome,
            d.comentario,
            BRL.format(d.valor),
          ].some((f) =>
            String(f || '')
              .toLowerCase()
              .includes(termo)
          )
        )
      : doces

    return [...base].sort((a, b) =>
      a.data < b.data
        ? 1
        : a.data > b.data
        ? -1
        : 0
    )
  }, [doces, filtro])

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white text-gray-800">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-rose-100">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/favicon.png"
              alt="Logo"
              width={40}
              height={40}
              className="rounded-2xl shadow-sm"
            />

            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                Dutícia Doces
              </h1>

              <p className="text-xs text-gray-500 -mt-0.5">
                Cadastro e avaliação dos doces 🍬
              </p>
            </div>
          </div>

          <a
            href="#lista"
            className="text-sm px-3 py-1.5 rounded-xl border border-rose-200 hover:bg-rose-50"
          >
            Ver doces
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <section className="mb-10 bg-white rounded-3xl shadow-sm border border-rose-100 p-4 sm:p-5">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">
            {editandoId
              ? 'Editar doce'
              : 'Adicionar novo doce'}
          </h2>

          <form
            onSubmit={handleSubmit}
            className="grid md:grid-cols-2 gap-4"
          >
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Nome do doce *
              </label>

              <input
                type="text"
                name="nome"
                value={form.nome}
                onChange={handleChange}
                placeholder="Ex.: Trufa de chocolate"
                className="w-full rounded-xl border border-rose-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-300"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Data *
              </label>

              <input
                type="date"
                name="data"
                value={form.data}
                onChange={handleChange}
                className="w-full rounded-xl border border-rose-200 px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Valor pago *
              </label>

              <input
                type="number"
                min={0}
                step="0.01"
                name="valor"
                value={form.valor}
                onChange={handleChange}
                placeholder="0,00"
                className="w-full rounded-xl border border-rose-200 px-3 py-2"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Foto do doce
              </label>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleFotoChange}
                className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100"
              />

              {form.foto && (
                <div className="mt-3 flex items-center gap-3">
                  <img
                    src={form.foto}
                    alt="Prévia"
                    className="h-20 w-20 object-cover rounded-xl border"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        foto: '',
                      }))
                    }
                    className="text-xs text-rose-700 underline"
                  >
                    Remover foto
                  </button>
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Comentário
              </label>

              <textarea
                name="comentario"
                value={form.comentario}
                onChange={handleChange}
                rows={3}
                placeholder="O que acharam?"
                className="w-full rounded-xl border border-rose-200 px-3 py-2"
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">
                  Nota (0 a 10)
                </label>

                <input
                  type="number"
                  name="nota"
                  value={form.nota}
                  onChange={handleChange}
                  min={0}
                  max={10}
                  step={0.5}
                  className="w-full rounded-xl border border-rose-200 px-3 py-2"
                  required
                />
              </div>

              <div className="pt-6">
                <Stars
                  rating={Number(form.nota)}
                  size={24}
                />
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end gap-3 pt-2">
              {editandoId && (
                <button
                  type="button"
                  onClick={limparFormulario}
                  className="px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              )}

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-rose-600 text-white font-medium shadow hover:bg-rose-700 disabled:opacity-60"
              >
                {saving
                  ? 'Salvando…'
                  : editandoId
                  ? 'Salvar mudanças'
                  : 'Adicionar doce'}
              </button>
            </div>
          </form>
        </section>

        <section className="mb-4" id="lista">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <h2 className="text-xl font-semibold text-gray-800">
              Doces cadastrados
            </h2>

            <div className="flex-1" />

            <input
              type="search"
              value={filtro}
              onChange={(e) =>
                setFiltro(e.target.value)
              }
              placeholder="Buscar doces..."
              className="w-full sm:w-80 rounded-xl border border-rose-200 px-3 py-2"
            />
          </div>
        </section>

        {loading ? (
          <div className="text-center text-gray-500 border border-dashed border-rose-200 rounded-3xl p-10">
            Carregando…
          </div>
        ) : docesFiltrados.length === 0 ? (
          <div className="text-center text-gray-500 border border-dashed border-rose-200 rounded-3xl p-10">
            Nenhum doce cadastrado.
          </div>
        ) : (
          <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {docesFiltrados.map((d) => (
              <article
                key={d.id}
                className="bg-white rounded-3xl shadow-sm border border-rose-100 overflow-hidden flex flex-col"
              >
                {d.foto ? (
                  <img
                    src={d.foto}
                    alt={d.nome}
                    className="w-full object-cover h-40 sm:h-44 md:h-52"
                  />
                ) : (
                  <div className="h-40 sm:h-44 md:h-52 w-full grid place-items-center bg-rose-50 text-rose-600 text-sm">
                    Sem foto
                  </div>
                )}

                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-semibold text-lg leading-tight">
                    {d.nome}
                  </h3>

                  <div className="mt-1 flex items-center justify-between text-sm text-gray-600">
                    <span>
                      {new Date(
                        d.data + 'T00:00:00'
                      ).toLocaleDateString('pt-BR')}
                    </span>

                    <span className="font-medium">
                      {BRL.format(
                        Number(d.valor) || 0
                      )}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <Stars
                      rating={Number(d.nota)}
                    />
                  </div>

                  {d.comentario && (
                    <p className="mt-2 text-sm text-gray-700 line-clamp-3">
                      {d.comentario}
                    </p>
                  )}

                  <div className="mt-auto pt-4 flex items-center gap-2">
                    <button
                      onClick={() => editar(d.id)}
                      className="px-3 py-1.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-sm"
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => excluir(d.id)}
                      className="px-3 py-1.5 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-sm"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}

        <footer className="text-center text-xs text-gray-500 mt-10 mb-6">
          Feito com 💕 para Duda e Lê.
        </footer>
      </main>
    </div>
  )
}
