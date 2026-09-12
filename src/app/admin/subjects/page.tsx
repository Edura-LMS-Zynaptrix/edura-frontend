'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SubjectsRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/admin/streams') }, [router])
  return null
}
