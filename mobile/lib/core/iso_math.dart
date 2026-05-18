import 'dart:ui';
import 'constants.dart';

/// Converts tile grid coords to isometric screen-space center point.
/// Classic Habbo 2:1 projection: moving col+1 goes right+down, row+1 goes left+down.
Offset tileToScreen(int col, int row) => Offset(
      (col - row) * tileWHalf,
      (col + row) * tileHHalf,
    );

/// Inverse: screen point -> fractional tile coords. Round to nearest int for hit-testing.
Offset screenToTile(double sx, double sy) => Offset(
      (sx / tileWHalf + sy / tileHHalf) / 2,
      (sy / tileHHalf - sx / tileWHalf) / 2,
    );

/// Painter's-algorithm depth value for a tile. Higher = drawn later = on top.
/// Multiply by 10 so avatars/furniture can interleave (e.g. depth*10+5 for avatar).
int tileDepth(int col, int row) => (col + row) * 10;
