/**
 * This is a user authentication API route demo.
 * Handle user registration, login, token management, etc.
 */
import { Router, type Request, type Response } from 'express'
import { generateUserSig } from '../utils/trtc.js'

const router = Router()

/**
 * User Login
 * POST /api/auth/register
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  // TODO: Implement register logic
})

/**
 * User Login
 * POST /api/auth/login
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  // TODO: Implement login logic
})

/**
 * User Logout
 * POST /api/auth/logout
 */
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  // TODO: Implement logout logic
})

/**
 * Get TRTC UserSig
 * POST /api/auth/trtc_sig
 */
router.post('/trtc_sig', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body
    if (!userId) {
      res.status(400).json({ success: false, error: '缺少 userId' })
      return
    }
    const result = generateUserSig(userId)
    res.json({ success: true, data: result })
  } catch (e: any) {
    console.error('TRTC Error:', e)
    res.status(500).json({ success: false, error: e.message || '生成 UserSig 失败' })
  }
})

export default router
