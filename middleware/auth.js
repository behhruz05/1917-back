const jwt = require("jsonwebtoken");

const auth = (req, res, next) => {

    const header = req.headers.authorization;

    if (!header) {
        return res.status(401).json({ message: "Token yoq" });
    }

    // Bearer TOKEN
    const token = header.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "Token notogri format" });
    }

    try {

        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET, { algorithms: ["HS256"] });

        req.user = decoded;

        next();

    } catch (err) {

        return res.status(401).json({ message: "Token notogri yoki eskirgan" });

    }

};

module.exports = auth;