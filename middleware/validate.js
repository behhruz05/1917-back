const Joi = require("joi")

const registerSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(100).required(),
})

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(1).required(),
})

const productSchema = Joi.object({
  name: Joi.string().min(1).max(200).required(),
  price: Joi.number().positive().required(),
  description: Joi.string().max(1000).optional(),
  category: Joi.string().max(100).optional(),
})

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false })
  if (error) {
    const messages = error.details.map((d) => d.message)
    return res.status(400).json({ message: "Validatsiya xatosi", errors: messages })
  }
  next()
}

module.exports = { validate, registerSchema, loginSchema, productSchema }
