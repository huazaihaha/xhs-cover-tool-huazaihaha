/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
} from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import generateRoutes from './routes/generate.js'
import imageRoutes from './routes/image.js'
import namingRoutes from './routes/naming.js'
import usageRoutes from './routes/usage.js'

// load env
dotenv.config()

const app: express.Application = express()

// Honor X-Forwarded-For when deployed behind reverse proxies like Render.
app.set('trust proxy', true)

app.use(cors())
app.use(express.json({ limit: '30mb' }))
app.use(express.urlencoded({ extended: true, limit: '30mb' }))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/generate', generateRoutes)
app.use('/api/image', imageRoutes)
app.use('/api/naming', namingRoutes)
app.use('/api/usage', usageRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
