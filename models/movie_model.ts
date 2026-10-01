import { ActorModel as ActorModel } from './actor_model'

export type MovieModel = {
  video_id?: string | null
  video_code?: string
  video_code_id?: string | null
  title?: string
  title_en?: string
  title_ja?: string | null
  description?: string
  fan_art?: string
  poster?: string
  trailer?: string
  actors?: ActorModel[]
  genre?: string[]
  release_date?: string | null
  release_date_formated?: string | null
  duration?: number
  duration_formated?: string
  studio?: string
  label?: string
  director?: string
  series?: string
  screenshot?: string[]
  view_count?: number | null
  score?: number | null
}
