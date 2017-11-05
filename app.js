const express = require('express'), // Express web server framework
 request = require('request'), // "Request" library
 querystring = require('querystring'),
 cookieParser = require('cookie-parser'),
  PORT = process.env.PORT || 8888

require('./config/keys.js')
const client_id = process.env.CLIENT_ID
const client_secret = process.env.CLIENT_SECRET
const redirect_uri = 'http://localhost:8888/callback' // redirect uri

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
const generateRandomString = (length) => {
  let text = ''
  let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}

const stateKey = 'spotify_auth_state', 
app = express()

app.use(express.static(__dirname + '/public'))
  .use(cookieParser())

app.get('https://simify.herokuapp.com/login', (req, res) => {

  let state = generateRandomString(16)
  res.cookie(stateKey, state)

  // application requests authorization
  let scope = 'user-read-private user-read-email'
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }))
})

app.get('https://simify.herokuapp.com/callback', (req, res) => {
  // application requests refresh and access tokens
  // after checking the state parameter
  let code = req.query.code || null
  let state = req.query.state || null
  let storedState = req.cookies ? req.cookies[stateKey] : null

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }))
  } else {
    res.clearCookie(stateKey)
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    }

    request.post(authOptions, (error, response, body) => {
      if (!error && response.statusCode === 200) {

        let access_token = body.access_token,
          refresh_token = body.refresh_token

        let options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        }

        // access token to access the Spotify Web API
        request.get(options, (error, response, body) => {
          // console.log(body)
        })

        // pass the token to the browser to make requests
        res.redirect('https://simify.herokuapp.com/#' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token
          }))
      } else {
        res.redirect('https://simify.herokuapp.com/#' +
          querystring.stringify({
            error: 'invalid_token'
          }))
      }
    })
  }
})

app.get('https://simify.herokuapp.com/refresh_token', (req, res) => {

  // requesting access token from refresh token
  let refresh_token = req.query.refresh_token
  let authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  }

  request.post(authOptions, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      let access_token = body.access_token
      res.send({
        'access_token': access_token
      })
    }
  })
})

app.listen(PORT, () => console.log(`Listening on port ${PORT}`))
