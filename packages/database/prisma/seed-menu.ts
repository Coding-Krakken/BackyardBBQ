import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedMenu() {
  console.log('Starting menu seed...');

  // Ensure we have a location first
  let location = await prisma.location.findFirst({
    where: { type: 'brick_and_mortar' }
  });

  if (!location) {
    console.log('Creating default location...');
    location = await prisma.location.create({
      data: {
        name: 'Backyard BBQ King - Main',
        type: 'brick_and_mortar',
        timezone: 'America/New_York',
        isActive: true,
        maxCateringCap: 500
      }
    });
  }

  console.log(`Using location: ${location.name} (${location.id})`);

  // Clear all existing menu items so the actual menu fully replaces any legacy/demo data.
  await prisma.menuItem.deleteMany({});

  console.log('Creating menu items...');

  const menuItems = [
    // COMBOS (3 items)
    {
      name: 'Half Rack Beef Rib Combo',
      description: 'Slow-smoked half rack of beef ribs with bold bark, deep smoke flavor, and two homestyle sides.',
      basePriceCents: 2800,
      imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=1200&h=900&fit=crop',
      category: 'combos',
      sortOrder: 1,
      isFeatured: true,
      customizations: [
        { name: 'Extra BBQ Sauce', priceCents: 100 }
      ]
    },
    {
      name: '4 Beef Rib Combo',
      description: 'Four juicy beef ribs smoked low and slow until tender, served with your choice of two classic sides.',
      basePriceCents: 2400,
      imageUrl: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=1200&h=900&fit=crop',
      category: 'combos',
      sortOrder: 2,
      isFeatured: true,
      customizations: [
        { name: 'Extra BBQ Sauce', priceCents: 100 }
      ]
    },
    {
      name: '3 Beef Rib Combo',
      description: 'Three meaty beef ribs finished with our signature glaze and paired with two comfort-food sides.',
      basePriceCents: 2100,
      imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200&h=900&fit=crop',
      category: 'combos',
      sortOrder: 3,
      isFeatured: true,
      customizations: [
        { name: 'Extra BBQ Sauce', priceCents: 100 }
      ]
    },

    // DRINKS (8 items)
    {
      name: 'Sweet Tea',
      description: 'Fresh-brewed Southern sweet tea, chilled and perfectly balanced for smoky BBQ plates.',
      basePriceCents: 300,
      imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=1200&h=900&fit=crop',
      category: 'drinks',
      sortOrder: 1,
      customizations: [
        { name: 'Unsweetened', priceCents: 0 },
        { name: 'Extra Lemon', priceCents: 50 }
      ]
    },
    {
      name: 'Water',
      description: 'Ice-cold bottled water served chilled.',
      basePriceCents: 200,
      imageUrl: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=1200&h=900&fit=crop',
      category: 'drinks',
      sortOrder: 2
    },
    {
      name: 'Orange Soda',
      description: 'Bright citrus soda with a crisp, bubbly finish.',
      basePriceCents: 300,
      imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=1200&h=900&fit=crop',
      category: 'drinks',
      sortOrder: 3
    },
    {
      name: 'Fruit Punch',
      description: 'Sweet tropical fruit punch with a refreshing, smooth finish.',
      basePriceCents: 300,
      imageUrl: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=1200&h=900&fit=crop',
      category: 'drinks',
      sortOrder: 4
    },
    {
      name: 'Sprite',
      description: 'Classic lemon-lime soda, cold and crisp.',
      basePriceCents: 300,
      imageUrl: 'https://images.unsplash.com/photo-1624517452488-04869289c4ca?w=1200&h=900&fit=crop',
      category: 'drinks',
      sortOrder: 5
    },
    {
      name: 'Root Beer',
      description: 'Smooth and creamy root beer with rich vanilla notes.',
      basePriceCents: 300,
      imageUrl: 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=1200&h=900&fit=crop',
      category: 'drinks',
      sortOrder: 6
    },
    {
      name: 'Coke 16oz',
      description: '16oz Coca-Cola served ice cold.',
      basePriceCents: 300,
      imageUrl: 'https://images.unsplash.com/photo-1596803244535-925769f38992?w=1200&h=900&fit=crop',
      category: 'drinks',
      sortOrder: 7
    },
    {
      name: 'Pepsi 16oz',
      description: '16oz Pepsi with bold cola flavor, served chilled.',
      basePriceCents: 300,
      imageUrl: 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=1200&h=900&fit=crop',
      category: 'drinks',
      sortOrder: 8
    },

    // MEATS (16 items)
    {
      name: 'Beef Sausages',
      description: 'House-smoked beef sausages with a snappy casing, juicy center, and deep pit flavor.',
      basePriceCents: 1300,
      imageUrl: 'https://images.unsplash.com/photo-1612392062798-2dbea6e9c097?w=1200&h=900&fit=crop',
      category: 'meats',
      sortOrder: 1
    },
    {
      name: 'HotDogs',
      description: 'All-beef hotdogs grilled and served on toasted buns with classic topping options.',
      basePriceCents: 600,
      imageUrl: 'https://images.unsplash.com/photo-1612392062798-2dbea6e9c097?w=1200&h=900&fit=crop',
      category: 'meats',
      sortOrder: 2,
      customizations: [
        { name: 'Add Chili', priceCents: 200 },
        { name: 'Add Cheese', priceCents: 150 }
      ]
    },
    {
      name: 'Hamburgers',
      description: 'Juicy grilled burgers with smoky sear and fresh toppings.',
      basePriceCents: 1200,
      imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1200&h=900&fit=crop',
      category: 'meats',
      sortOrder: 3,
      customizations: [
        { name: 'Add Cheese', priceCents: 150 },
        { name: 'Add Bacon', priceCents: 200 }
      ]
    },
    {
      name: 'Pulled Chicken',
      description: 'Tender smoked chicken, hand-pulled and finished with light pit seasoning.',
      basePriceCents: 1400,
      imageUrl: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=1200&h=900&fit=crop',
      category: 'meats',
      sortOrder: 4
    },
    {
      name: 'Pulled Pork',
      description: 'Slow-smoked pork shoulder, juicy and full of sweet, savory smoke flavor.',
      basePriceCents: 1600,
      imageUrl: 'https://images.unsplash.com/photo-1558030006-450675393462?w=1200&h=900&fit=crop',
      category: 'meats',
      sortOrder: 5
    },
    {
      name: 'Breast Only Chicken',
      description: 'Lean smoked chicken breast sliced fresh with delicate smoke and natural juices.',
      basePriceCents: 1000,
      imageUrl: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=1200&h=900&fit=crop',
      category: 'meats',
      sortOrder: 6
    },
    {
      name: 'Thighs Only Chicken',
      description: 'Rich, tender smoked chicken thighs with bold seasoning and deep flavor.',
      basePriceCents: 900,
      imageUrl: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=1200&h=900&fit=crop',
      category: 'meats',
      sortOrder: 7
    },
    {
      name: 'Legs Only Chicken',
      description: 'Smoked chicken legs with crisped skin and juicy, flavorful meat.',
      basePriceCents: 850,
      imageUrl: 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=1200&h=900&fit=crop',
      category: 'meats',
      sortOrder: 8
    },
    {
      name: 'Whole Chicken',
      description: 'Whole bird smoked evenly for full flavor, crispy skin, and moist meat from end to end.',
      basePriceCents: 2200,
      imageUrl: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=1200&h=900&fit=crop',
      category: 'meats',
      sortOrder: 9
    },
    {
      name: '1/2 Chicken',
      description: 'Half smoked chicken, perfectly seasoned and pit-cooked until tender.',
      basePriceCents: 1200,
      imageUrl: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=1200&h=900&fit=crop',
      category: 'meats',
      sortOrder: 10
    },
    {
      name: 'Wings only',
      description: 'Smoky chicken wings with crisp edges and juicy centers.',
      basePriceCents: 1100,
      imageUrl: 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=1200&h=900&fit=crop',
      category: 'meats',
      sortOrder: 11
    },
    {
      name: 'Breast And Wing Chicken',
      description: 'A balanced white-meat plate featuring smoked breast and wing cuts.',
      basePriceCents: 1150,
      imageUrl: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=1200&h=900&fit=crop',
      category: 'meats',
      sortOrder: 12
    },
    {
      name: 'Leg And Thigh Chicken',
      description: 'Dark-meat combo with smoky depth and extra juiciness.',
      basePriceCents: 950,
      imageUrl: 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=1200&h=900&fit=crop',
      category: 'meats',
      sortOrder: 13
    },
    {
      name: 'Pork Ribs',
      description: 'St. Louis-style pork ribs with sticky glaze and deep hickory smoke.',
      basePriceCents: 2400,
      imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=1200&h=900&fit=crop',
      category: 'meats',
      sortOrder: 14,
      isFeatured: true
    },
    {
      name: 'Beef Ribs',
      description: 'Thick-cut beef ribs with rich marbling, smoked until beautifully tender.',
      basePriceCents: 3200,
      imageUrl: 'https://images.unsplash.com/photo-1551218372-a8789b81b253?w=1200&h=900&fit=crop',
      category: 'meats',
      sortOrder: 15,
      isFeatured: true
    },
    {
      name: 'Brisket',
      description: 'Signature brisket smoked low and slow for a peppery bark, rosy smoke ring, and buttery bite.',
      basePriceCents: 2600,
      imageUrl: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=1200&h=900&fit=crop',
      category: 'meats',
      sortOrder: 16,
      isFeatured: true
    },

    // SIDES (10 items)
    {
      name: 'Coleslaw',
      description: 'Cool, crunchy slaw with a creamy tang that cuts perfectly through smoky meats.',
      basePriceCents: 400,
      imageUrl: 'https://images.unsplash.com/photo-1600850306720-68005a7d13c7?w=1200&h=900&fit=crop',
      category: 'sides',
      sortOrder: 1
    },
    {
      name: 'Potato Salad',
      description: 'Classic potato salad with creamy dressing and bright mustard notes.',
      basePriceCents: 450,
      imageUrl: 'https://images.unsplash.com/photo-1505253758473-96b7015fcd40?w=1200&h=900&fit=crop',
      category: 'sides',
      sortOrder: 2
    },
    {
      name: 'Green Beans',
      description: 'Southern-style green beans simmered with savory seasoning.',
      basePriceCents: 400,
      imageUrl: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=1200&h=900&fit=crop',
      category: 'sides',
      sortOrder: 3
    },
    {
      name: 'Sweet Garlic Butter Corn On The Cob',
      description: 'Grilled corn brushed with sweet garlic butter for rich, smoky sweetness.',
      basePriceCents: 350,
      imageUrl: 'https://images.unsplash.com/photo-1603570388624-7e06cdab0169?w=1200&h=900&fit=crop',
      category: 'sides',
      sortOrder: 4
    },
    {
      name: 'Mac Salad',
      description: 'Chilled macaroni salad with creamy dressing and a light tang.',
      basePriceCents: 400,
      imageUrl: 'https://images.unsplash.com/photo-1597140139392-e2de66b4a8b7?w=1200&h=900&fit=crop',
      category: 'sides',
      sortOrder: 5
    },
    {
      name: 'Tuna Salad',
      description: 'Fresh tuna salad made creamy and bright, served cold as a light side.',
      basePriceCents: 500,
      imageUrl: 'https://images.unsplash.com/photo-1559847844-d721426d6edc?w=1200&h=900&fit=crop',
      category: 'sides',
      sortOrder: 6
    },
    {
      name: 'Baked Beans',
      description: 'Sweet and smoky pit beans slow-cooked with BBQ spices.',
      basePriceCents: 450,
      imageUrl: 'https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?w=1200&h=900&fit=crop',
      category: 'sides',
      sortOrder: 7,
      isFeatured: true
    },
    {
      name: 'Mac & Cheese',
      description: 'Creamy baked macaroni and cheese with rich cheddar flavor and golden top.',
      basePriceCents: 500,
      imageUrl: 'https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?w=1200&h=900&fit=crop',
      category: 'sides',
      sortOrder: 8,
      isFeatured: true
    },
    {
      name: 'Collard Greens',
      description: 'Slow-simmered collard greens with savory, smoky depth.',
      basePriceCents: 450,
      imageUrl: 'https://images.unsplash.com/photo-1598511757337-fe2cafc31ba0?w=1200&h=900&fit=crop',
      category: 'sides',
      sortOrder: 9
    },
    {
      name: 'Fries',
      description: 'Golden fries, hot and crisp, salted and ready for dipping.',
      basePriceCents: 400,
      imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=1200&h=900&fit=crop',
      category: 'sides',
      sortOrder: 10
    }
  ];

  // Create all menu items
  for (const item of menuItems) {
    await prisma.menuItem.create({
      data: {
        locationId: location.id,
        name: item.name,
        description: item.description,
        basePriceCents: item.basePriceCents,
        imageUrl: item.imageUrl,
        category: item.category,
        sortOrder: item.sortOrder,
        isFeatured: item.isFeatured || false,
        customizations: item.customizations || null,
        isAvailable: true
      }
    });
    console.log(`✓ Created: ${item.name}`);
  }

  console.log(`\nMenu seed complete! Created ${menuItems.length} items.`);
  console.log('\nCategories:');
  console.log('  - Combos: 3 items');
  console.log('  - Meats: 16 items');
  console.log('  - Sides: 10 items');
  console.log('  - Drinks: 8 items');
}

seedMenu()
  .catch((e) => {
    console.error('Error seeding menu:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
