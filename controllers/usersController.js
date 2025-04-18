const asyncHandler = require("express-async-handler");
const User = require("../models/users");

const AUTH0_ENDPOINT = "https://dev-cdsfu1xs67k0fh7b.us.auth0.com/oauth/token";
const AUTH0_USER_ENDPOINT =
  "https://dev-cdsfu1xs67k0fh7b.us.auth0.com/api/v2/users";

const syncUser = async (req, res) => {
  const { sub, email, name, picture, email_verified } = req.body;
  try {
    await User.findOneAndUpdate(
      { auth0_id: sub },
      {
        email,
        name,
        picture,
        is_verified: email_verified,
        last_seen: new Date(),
      },
      { upsert: true, new: true }
    );
    res.status(200).send({ message: "Success" });
  } catch (err) {
    res.status(500).send({ message: "Internal Server Error" });
  }
};

const allUsers = async (req, res) => {
  try {
    const accessToken = await fetchMgmntApiToken();
    const allUsers = await fetchUsersfromAuth0(accessToken);
    const userResponse = allUsers
      ?.map((user) => {
        return {
          name: user.name,
          userId: user?.user_id,
          profilePicture: user?.picture,
          email: user?.email,
        };
      })
      .filter((e) => e.userId != req.auth.payload.sub);
    res.send({ status: 200, users: userResponse });
  } catch (err) {
    console.log("error", err);
    res.send({ status: 500, users: [] });
  }
};

async function fetchMgmntApiToken() {
  try {
    const auth0Response = await fetch(AUTH0_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: "2HQCnB3j2GGNaIBOD0ezFWzwzYUC98UL",
        client_secret:
          "08dvws6TEwQuvBfPUS_8eeJ7-wHM0FKAtiZgS18MEgSecYNNh9O900Fh9ONwt9ib",
        audience: "https://dev-cdsfu1xs67k0fh7b.us.auth0.com/api/v2/",
        grant_type: "client_credentials",
      }),
    });
    if (auth0Response) {
      const accessToken = await auth0Response.json();
      const { access_token } = accessToken;
      return access_token;
    }
  } catch (err) {
    throw err;
  }
}

async function fetchUsersfromAuth0(accessToken) {
  try {
    const usersResponse = await fetch(AUTH0_USER_ENDPOINT, {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });
    const userData = usersResponse.json();
    return userData;
  } catch (err) {
    console.log("Error", err);
  }
}

module.exports = { allUsers, syncUser };
