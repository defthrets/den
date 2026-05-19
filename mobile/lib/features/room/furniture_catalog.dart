/// Furniture catalogue — mirrors preview/furniture.js.
/// Each id corresponds to a PNG bundled at `assets/furniture/<id>.png`.

class FurnitureItem {
  final String id;
  final String name;
  const FurnitureItem({required this.id, required this.name});
}

class FurnitureCatalog {
  static const List<FurnitureItem> all = [
    FurnitureItem(id: 'chair_wood',  name: 'Wooden chair'),
    FurnitureItem(id: 'sofa_red',    name: 'Red sofa'),
    FurnitureItem(id: 'bed_blue',    name: 'Blue bed'),
    FurnitureItem(id: 'plant_tall',  name: 'Tall plant'),
    FurnitureItem(id: 'table_round', name: 'Round table'),
    FurnitureItem(id: 'lamp_floor',  name: 'Floor lamp'),
    FurnitureItem(id: 'rug_persian', name: 'Persian rug'),
  ];
}

class FurniturePlacement {
  final String id;
  final int col;
  final int row;
  const FurniturePlacement({required this.id, required this.col, required this.row});
}
