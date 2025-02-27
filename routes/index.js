const express = require("express");
const router = express.Router();
const {
  registerUser,
  login,
  logout,
  userDetails,
  updateUser,
  searchUser,
  getAllUsers,
  getAllConv,
} = require("../controllers/userController");
const { isAuth } = require("../middleware/isAuth");

router.route("/register").post(registerUser);
router.route("/login").post(login);
router.route("/logout").get(logout);
router.route("/userDetails").get(isAuth, userDetails);
router.route("/updateUser").put(updateUser);
router.route("/searchUser").post(searchUser);
router.route('/getAllUsers').get(getAllUsers);
router.route('/getAllConv').get(getAllConv);

module.exports = router;
