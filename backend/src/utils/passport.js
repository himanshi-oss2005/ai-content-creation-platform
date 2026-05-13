const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const User = require('../models/User');

passport.use(new GoogleStrategy({
  clientID:     process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:  '/api/auth/google/callback',
}, async (_accessToken, _refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ googleId: profile.id });
    if (!user) {
      const email = profile.emails?.[0]?.value;
      user = await User.findOne({ email });
      if (user) {
        user.googleId = profile.id;
        await user.save();
      } else {
        user = await User.create({
          name:            profile.displayName,
          email,
          googleId:        profile.id,
          oauthProvider:   'google',
          isEmailVerified: true,
        });
      }
    }
    done(null, user);
  } catch (err) {
    done(err);
  }
}));

passport.use(new GitHubStrategy({
  clientID:     process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL:  '/api/auth/github/callback',
  scope:        ['user:email'],
}, async (_accessToken, _refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ githubId: profile.id });
    if (!user) {
      const email = profile.emails?.[0]?.value;
      user = await User.findOne({ email });
      if (user) {
        user.githubId = profile.id;
        await user.save();
      } else {
        user = await User.create({
          name:            profile.displayName || profile.username,
          email:           email || `${profile.username}@github.noemail`,
          githubId:        profile.id,
          oauthProvider:   'github',
          isEmailVerified: true,
        });
      }
    }
    done(null, user);
  } catch (err) {
    done(err);
  }
}));

module.exports = passport;
