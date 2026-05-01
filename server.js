const express = require("express")
const mongoose = require("mongoose")
const bcrypt = require("bcrypt")
const rateLimit = require("express-rate-limit")
const helmet = require("helmet")
const cors = require("cors")
require("dotenv").config()

const swaggerUi = require("swagger-ui-express")
const swaggerSpec = require("./swagger")

const generateTokens = require("./utils/generateTokens")
const auth = require("./middleware/auth")
const { validate, registerSchema, loginSchema, productSchema } = require("./middleware/validate")

const User = require("./model/user.model")
const Product = require("./model/product.model")
const RefreshToken = require("./model/refreshToken.model")

const jwt = require("jsonwebtoken")

const app = express()
const port = process.env.PORT || 4444

/* SECURITY HEADERS */
app.use(helmet())

/* CORS */
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true,
}))

app.use(express.json({ limit: "10kb" }))

/* SWAGGER */
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec))

/* DATABASE */
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB xatosi:", err))

/* NO-CACHE — himoyalangan endpointlar uchun */
const noCache = (req, res, next) => {
  res.set("Cache-Control", "no-store")
  next()
}

/* RATE LIMITERS */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Juda ko'p urinish. 15 daqiqadan keyin qayta urining." },
})

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { message: "Juda ko'p ro'yxatdan o'tish. 1 soatdan keyin qayta urining." },
})

/* TEST */
app.get("/", (req, res) => {
  res.send("API WORKING")
})

/**
 * @swagger
 * tags:
 *   - name: User
 *     description: User API
 *   - name: Product
 *     description: Product API
 */

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Register user
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 example: Behruz
 *               email:
 *                 type: string
 *                 example: behruz@gmail.com
 *               password:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: User created
 *       400:
 *         description: Email already exists
 *       500:
 *         description: Server error
 */
app.post("/register", registerLimiter, validate(registerSchema), async (req, res) => {
  try {
    const { name, email, password } = req.body

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = new User({ name, email, password: hashedPassword })
    await user.save()

    const tokens = generateTokens(user)

    await RefreshToken.create({
      token: tokens.refreshToken,
      user: user._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })

    const userObj = user.toObject()
    delete userObj.password

    res.json({ message: "User created", user: userObj, ...tokens })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Server xatosi" })
  }
})

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Login user
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: behruz@gmail.com
 *               password:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Login success
 *       400:
 *         description: Wrong password
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
app.post("/login", loginLimiter, validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await User.findOne({ email })

    // timing attack: user yo'q bo'lsa ham bcrypt ishlaydi, vaqt farqi yo'qoladi
    const dummyHash = "$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345"
    const isMatch = await bcrypt.compare(password, user ? user.password : dummyHash)

    if (!user || !isMatch) {
      return res.status(401).json({ message: "Email yoki parol noto'g'ri" })
    }

    const tokens = generateTokens(user)

    await RefreshToken.create({
      token: tokens.refreshToken,
      user: user._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })

    const userObj = user.toObject()
    delete userObj.password

    res.json({ message: "Login success", user: userObj, ...tokens })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Server xatosi" })
  }
})

/**
 * @swagger
 * /refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: New access token
 *       401:
 *         description: Invalid or expired refresh token
 */
app.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token yo'q" })
    }

    const stored = await RefreshToken.findOne({ token: refreshToken })
    if (!stored) {
      return res.status(401).json({ message: "Refresh token yaroqsiz" })
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, {
      algorithms: ["HS256"],
    })

    const user = await User.findById(decoded.id)
    if (!user) {
      return res.status(401).json({ message: "Foydalanuvchi topilmadi" })
    }

    // token rotation: eski o'chirilib yangi beriladi
    await RefreshToken.deleteOne({ token: refreshToken })

    const newTokens = generateTokens(user)
    await RefreshToken.create({
      token: newTokens.refreshToken,
      user: user._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })

    res.json({ accessToken: newTokens.accessToken, refreshToken: newTokens.refreshToken })
  } catch (err) {
    console.error(err)
    return res.status(401).json({ message: "Refresh token yaroqsiz yoki eskirgan" })
  }
})

/**
 * @swagger
 * /logout:
 *   post:
 *     summary: Logout user
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logged out
 */
app.post("/logout", async (req, res) => {
  try {
    const { refreshToken } = req.body
    if (refreshToken) {
      await RefreshToken.deleteOne({ token: refreshToken })
    }
    res.json({ message: "Logout muvaffaqiyatli" })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Server xatosi" })
  }
})

/**
 * @swagger
 * /profile:
 *   get:
 *     summary: Get my profile
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
app.get("/profile", auth, noCache, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password")
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }
    res.json({ message: "Protected", user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Server xatosi" })
  }
})

/**
 * @swagger
 * /products:
 *   post:
 *     summary: Create product
 *     tags: [Product]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *             properties:
 *               name:
 *                 type: string
 *                 example: iPhone 15
 *               price:
 *                 type: number
 *                 example: 1200
 *               description:
 *                 type: string
 *                 example: Apple phone
 *               category:
 *                 type: string
 *                 example: phone
 *     responses:
 *       200:
 *         description: Product created
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
app.post("/products", auth, noCache, validate(productSchema), async (req, res) => {
  try {
    const { name, price, description, category } = req.body

    const product = new Product({
      name,
      price,
      description,
      category,
      user: req.user.id,
    })

    await product.save()
    res.json(product)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Server xatosi" })
  }
})

/**
 * @swagger
 * /products:
 *   get:
 *     summary: Get my products
 *     tags: [Product]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Products list
 *       401:
 *         description: Unauthorized
 */
app.get("/products", auth, noCache, async (req, res) => {
  try {
    const products = await Product.find({ user: req.user.id })
    res.json(products)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Server xatosi" })
  }
})

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     summary: Get one product
 *     tags: [Product]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Bu sizning productingiz emas
 *       404:
 *         description: Product not found
 */
app.get("/products/:id", auth, noCache, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)

    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    if (product.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Bu sizning productingiz emas" })
    }

    res.json(product)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Server xatosi" })
  }
})

/**
 * @swagger
 * /products/{id}:
 *   put:
 *     summary: Update product
 *     tags: [Product]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: iPhone 16
 *               price:
 *                 type: number
 *                 example: 1400
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Product updated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Bu sizning productingiz emas
 *       404:
 *         description: Product not found
 */
app.put("/products/:id", auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)

    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    if (product.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Bu sizning productingiz emas" })
    }

    const { name, price, description, category } = req.body

    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      { name, price, description, category },
      { new: true }
    )

    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Server xatosi" })
  }
})

/**
 * @swagger
 * /products/{id}:
 *   delete:
 *     summary: Delete product
 *     tags: [Product]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Bu sizning productingiz emas
 *       404:
 *         description: Product not found
 */
app.delete("/products/:id", auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)

    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    if (product.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Bu sizning productingiz emas" })
    }

    await Product.findByIdAndDelete(req.params.id)
    res.json({ message: "Deleted" })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Server xatosi" })
  }
})

app.listen(port, () => {
  console.log(`SERVER RUNNING http://localhost:${port}`)
})
