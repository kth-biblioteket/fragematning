const jwt = require("jsonwebtoken");
const config = require('./config.json');

function verify(req, res, next) {
    let token = req.cookies.jwt

    if (!token)
        return res.status(401).send({ auth: false, message: 'No token'});


        jwt.verify(token, config.secret, async function (err, decoded) {
            if (err) {
                res.clearCookie("jwt")
                return res.status(401).send({ auth: false, message: 'Failed to authenticate token, ' + err.message });
            }

            req.username = decoded.id;   
            let authorized = false;

            if(decoded.role === 'user' || decoded.role === 'admin') {
                authorized = true;
            }
            
            if (authorized) {
                req.token = jwt.sign({ id: req.username, role: config.roles[req.username] }, config.secret, {
                    expiresIn: "7d"
                });
                next();
            } else {
                return res.status(401).send({ auth: false, message: 'Not authorized'});
            }
        });
}

module.exports = verify;