/// Avatar pixel-art template — 32 wide × 56 tall.
/// Each char is one design pixel. Mirrored exactly in preview/renderer.js.
///
/// Legend:
///   .  transparent
///   o  outline (very dark)
///   H  hair main         h hair shadow         l hair highlight
///   S  skin main         s skin shadow         L skin light/highlight
///   e  eye pupil         w eye white           B brow / mouth shadow
///   M  mouth (pink)
///   1  shirt main        2 shirt shadow        3 shirt highlight
///   c  collar (skin)
///   P  pants main        p pants shadow
///   X  shoe              x shoe sole / shadow
const int avatarTplW = 32;
const int avatarTplH = 56;

const List<String> avatarTemplate = [
  "................................", //  0
  "............HHHHHHHH............", //  1
  "..........HhhhhhhhhhhH..........", //  2
  ".........HhhHHHHHHHHHHhhH.......", //  3
  "........HhHHHHHHHHHHHHHHhH......", //  4
  ".......HhHHHHHHHHHHHHHHHHhH.....", //  5
  ".......hHHHlHHHHHHHHHHHHHHh.....", //  6
  "......hHHHHHHSSSSSSSSHHHHHHh....", //  7
  "......hHHSSSSSSSSSSSSSSSSHHh....", //  8
  "......hHSSSSSSSSSSSSSSSSSSSh....", //  9
  "......hSSBBBSSSSSSSSBBBSSSSh....", // 10 eyebrows
  "......hSSeewwSSSSSSeewwSSSSh....", // 11 eyes
  "......hSSeewwSSSSSSeewwSSSSh....", // 12
  "......hSSSSSSSSSSSSSSSSSSSSh....", // 13
  "......hSSSSSSSSSLLLSSSSSSSSh....", // 14 nose
  "......hSSSSSSSSLLLSSSSSSSSSh....", // 15
  "......hSSSSSSSSSSSSSSSSSSSSh....", // 16
  "......hSSSSSSMMMMMMMMSSSSSSh....", // 17 mouth
  "......hSSSSSSBBBBBBBBSSSSSSh....", // 18
  "......hSSSSSSSSSSSSSSSSSSSSh....", // 19
  ".......ssSSSSSSSSSSSSSSSSss.....", // 20 chin
  "........sSSSSSSSSSSSSSSSs.......", // 21
  "..........SSSSSSSSSSSSS.........", // 22 neck
  "..........sSSSSSSSSSSs..........", // 23
  ".........11ScccccccS11..........", // 24 collar V
  "........1111ccccccc1111.........", // 25
  ".......111111ccccc111111........", // 26
  "......11111111ccc11111111.......", // 27
  ".....1111111111c1111111111......", // 28 shoulders
  "....S1111111111111111111111S....", // 29 arms
  "....S1111111122222222111111S....", // 30 shirt shading
  "....S1111111122222222111111S....", // 31
  "....S1111111122222222111111S....", // 32
  "....S1111111122222222111111S....", // 33
  "....S1111111122222222111111S....", // 34
  "....S1111111122222222111111S....", // 35
  "....S1111111122222222111111S....", // 36
  "....S1111111122222222111111S....", // 37
  "....S1111111122222222111111S....", // 38
  "....s1111111122222222111111s....", // 39
  "....sLL11111122222222111LLs.....", // 40 hands
  "....sLL11111122222222111LL......", // 41
  ".....1111111122222222111........", // 42
  "......11111122222222111.........", // 43
  ".......PPPPPP....PPPPPP.........", // 44 legs
  ".......PPPPPP....PPPPPP.........", // 45
  ".......PPPPPP....PPPPPP.........", // 46
  ".......PPPPPP....PPPPPP.........", // 47
  ".......PPPPPP....PPPPPP.........", // 48
  ".......ppppPP....PPpppp.........", // 49
  ".......ppppPP....PPpppp.........", // 50
  "......XXXXXXXX..XXXXXXXX........", // 51 shoes
  "......XXXXXXXX..XXXXXXXX........", // 52
  "......xxxxxxxx..xxxxxxxx........", // 53
  "................................", // 54
  "................................", // 55
];
