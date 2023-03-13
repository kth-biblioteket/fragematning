const jwt = require("jsonwebtoken");
const config = require('./config.json');

function verifyToken(req, res, next) {
    let token = req.cookies.jwt

    if (!token)
        return res.sendFile(__dirname.replace(/\w*$/, '') + 'frontend/dist/login.html');


        jwt.verify(token, config.secret, async function (err, decoded) {
            if (err) {
                res.clearCookie("jwt")
                return res.sendFile(__dirname.replace(/\w*$/, '') + 'frontend/dist/login.html');
            }
   
            req.username = decoded.id; 
            req.token = jwt.sign({ id: req.username, role: config.roles[req.username] }, config.secret, {
                expiresIn: "7d"
            });
            next();
        });
}

module.exports = verifyToken;