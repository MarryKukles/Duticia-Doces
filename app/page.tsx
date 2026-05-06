'use client'

import Image from 'next/image'
import React, {
  useEffect,
  useMemo,
  useState,
  useId,
} from 'react'

import { db } from '@/lib/firebase'

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from 'firebase/firestore'

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function classNames(...s: string[]) {
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
          <linearGradient id={gradId} x1="0" x2="100%" y1="0" y2="0">
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

  return (
    <div className="flex items-center gap-1">
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

export default function Page() {
  const [doces, setDoces] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [filtro, setFiltro] = useState('')

  const [form, setForm] = useState({
    nome: '',
    data: new Date().toISOString().slice(0, 10),
    valor: '',
    comentario: '',
    nota: 0,
  })

  async function refreshDoces() {
    const querySnapshot = await getDocs(collection(db, 'doces'))

    const lista: any[] = []

    querySnapshot.forEach((docItem) => {
      lista.push({
        id: docItem.id,
        ...docItem.data(),
      })
    })

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
      comentario: '',
      nota: 0,
    })

    setEditandoId(null)
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

  function validar() {
    if (!form.nome.trim()) {
      return 'Informe o nome do doce.'
    }

    if (!form.data) {
      return 'Informe a data.'
    }

    return null
  }

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault()

    if (saving) return

    const err = validar()

    if (err) {
      alert(err)
      return
    }

    setSaving(true)

    const payload = {
      nome: form.nome,
      data: form.data,
      valor: Number(form.valor),
      comentario: form.comentario,
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

      alert('Doce salvo com sucesso!')
    } catch (e: any) {
      console.error(e)
      alert('Erro ao salvar: ' + e.message)
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
      comentario: d.comentario || '',
      nota: d.nota,
    })

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  async function excluir(id: string) {
    if (!confirm('Deseja excluir este doce?')) return

    await deleteDoc(doc(db, 'doces', id))

    refreshDoces()
  }

  const docesFiltrados = useMemo(() => {
    const termo = filtro.trim().toLowerCase()

    if (!termo) return doces

    return doces.filter((d) =>
      [d.nome, d.comentario]
        .join(' ')
        .toLowerCase()
        .includes(termo)
    )
  }, [doces, filtro])

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white text-gray-800">
      <header className="sticky top-0 z-10 bg-white border-b border-rose-100">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Image
            src="/favicon.png"
            alt="Logo"
            width={40}
            height={40}
            className="rounded-2xl"
          />

          <div>
            <h1 className="text-2xl font-bold">
              Dutícia Doces
            </h1>

            <p className="text-sm text-gray-500">
              Cadastro e avaliação 🍬
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <section className="bg-white rounded-3xl shadow-sm border border-rose-100 p-5 mb-8">
          <h2 className="text-xl font-semibold mb-4">
            {editandoId
              ? 'Editar doce'
              : 'Adicionar doce'}
          </h2>

          <form
            onSubmit={handleSubmit}
            className="grid gap-4"
          >
            <input
              type="text"
              name="nome"
              value={form.nome}
              onChange={handleChange}
              placeholder="Nome do doce"
              className="border border-rose-200 rounded-xl px-3 py-2"
            />

            <input
              type="date"
              name="data"
              value={form.data}
              onChange={handleChange}
              className="border border-rose-200 rounded-xl px-3 py-2"
            />

            <input
              type="number"
              name="valor"
              value={form.valor}
              onChange={handleChange}
              placeholder="Valor"
              className="border border-rose-200 rounded-xl px-3 py-2"
            />

            <textarea
              name="comentario"
              value={form.comentario}
              onChange={handleChange}
              placeholder="Comentário"
              rows={3}
              className="border border-rose-200 rounded-xl px-3 py-2"
            />

            <input
              type="number"
              name="nota"
              value={form.nota}
              onChange={handleChange}
              min={0}
              max={10}
              step={0.5}
              className="border border-rose-200 rounded-xl px-3 py-2"
            />

            <div>
              <Stars rating={Number(form.nota)} size={24} />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl py-2 font-medium"
            >
              {saving
                ? 'Salvando...'
                : editandoId
                ? 'Salvar alterações'
                : 'Adicionar doce'}
            </button>
          </form>
        </section>

        <section className="mb-5">
          <input
            type="search"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar doces..."
            className="w-full border border-rose-200 rounded-xl px-3 py-2"
          />
        </section>

        {loading ? (
          <div className="text-center">
            Carregando...
          </div>
        ) : docesFiltrados.length === 0 ? (
          <div className="text-center">
            Nenhum doce cadastrado.
          </div>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {docesFiltrados.map((d) => (
              <article
                key={d.id}
                className="bg-white rounded-3xl border border-rose-100 p-4 shadow-sm"
              >
                <h3 className="font-bold text-lg">
                  {d.nome}
                </h3>

                <p className="text-sm text-gray-500 mt-1">
                  {new Date(
                    d.data + 'T00:00:00'
                  ).toLocaleDateString('pt-BR')}
                </p>

                <p className="font-medium mt-2">
                  {BRL.format(Number(d.valor))}
                </p>

                <div className="mt-2">
                  <Stars rating={Number(d.nota)} />
                </div>

                {d.comentario && (
                  <p className="mt-3 text-sm text-gray-700">
                    {d.comentario}
                  </p>
                )}

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => editar(d.id)}
                    className="border border-rose-200 rounded-xl px-3 py-1 text-sm"
                  >
                    Editar
                  </button>

                  <button
                    onClick={() => excluir(d.id)}
                    className="border border-red-200 text-red-600 rounded-xl px-3 py-1 text-sm"
                  >
                    Excluir
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  )
}
