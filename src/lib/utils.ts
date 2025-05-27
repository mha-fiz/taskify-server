export const generateInviteCode = (length: number) => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz01234567890!@#$%^&*()-=!";
  let code = "";
  let loop = 0;

  while (loop < length) {
    code += chars[Math.floor(Math.random() * chars.length)];
    loop++;
  }

  return code;
};
