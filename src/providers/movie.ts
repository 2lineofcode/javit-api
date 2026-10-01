import type { ActorModel } from './actor.ts'

export type MovieModel = {
  video_id?: string | null
  video_code?: string | null
  video_code_id?: string | null
  title?: string | null
  title_en?: string | null
  title_ja?: string | null
  description?: string | null
  fan_art?: string | null
  poster?: string | null
  trailer?: string | null
  actors?: ActorModel[]
  genre?: string[]
  release_date?: string | null
  release_date_formated?: string | null
  duration?: number | null
  duration_formated?: string | null
  studio?: string | null
  label?: string | null
  director?: string | null
  series?: string | null
  screenshot?: string[]
  view_count?: number | null
  score?: number | null
}
