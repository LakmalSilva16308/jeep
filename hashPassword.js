import bcrypt from "bcryptjs";
console.log(bcrypt.hashSync('admin123', 10));