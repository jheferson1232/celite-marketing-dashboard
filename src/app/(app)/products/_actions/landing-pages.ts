"use server"

import { createServerAction } from "@/lib/server-action"
import {
  createLandingPage,
  deleteLandingPage,
  listLandingPages,
  updateLandingPage,
  type LandingPageRecord,
} from "@/lib/services/landing-page"

export const listLandingPagesAction = createServerAction(
  async (): Promise<LandingPageRecord[]> => listLandingPages()
)

export const createLandingPageAction = createServerAction(
  async (input: { url: string }): Promise<LandingPageRecord> =>
    createLandingPage(input)
)

export const updateLandingPageAction = createServerAction(
  async (input: { id: string; url: string }): Promise<LandingPageRecord> =>
    updateLandingPage(input)
)

export const deleteLandingPageAction = createServerAction(
  async (id: string): Promise<void> => deleteLandingPage(id)
)
