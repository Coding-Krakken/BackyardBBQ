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

  // Clear existing menu items for this location
  await prisma.menuItem.deleteMany({
    where: { locationId: location.id }
  });

  console.log('Creating menu items...');

  const menuItems = [
    // MAINS / PLATTERS (7 items)
    {
      name: 'Smoked Brisket',
      description: '16-hour oak-smoked prime brisket with signature black pepper bark. Served sliced with house BBQ sauce.',
      basePriceCents: 2400,
      imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
      category: 'mains',
      sortOrder: 1,
      isFeatured: true,
      customizations: [
        { name: 'Extra Sauce', priceCents: 100 },
        { name: 'Double Portion', priceCents: 1200 }
      ]
    },
    {
      name: 'BBQ Rib Plate',
      description: 'Full rack of St. Louis-style ribs with sticky lacquered glaze. Fall-off-the-bone tender.',
      basePriceCents: 2200,
      imageUrl: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=800',
      category: 'mains',
      sortOrder: 2,
      isFeatured: true,
      customizations: [
        { name: 'Extra Sauce', priceCents: 100 },
        { name: 'Half Rack', priceCents: -800 }
      ]
    },
    {
      name: 'Pulled Pork Platter',
      description: 'Slow-smoked pork shoulder, hand-pulled and served with classic Carolina slaw.',
      basePriceCents: 1800,
      imageUrl: 'https://images.unsplash.com/photo-1558030006-450675393462?w=800',
      category: 'mains',
      sortOrder: 3,
      isFeatured: true
    },
    {
      name: 'Smoked Chicken Quarter',
      description: 'Juicy quarter chicken with crispy skin and smoky flavor. Your choice of leg or breast.',
      basePriceCents: 1400,
      imageUrl: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800',
      category: 'mains',
      sortOrder: 4
    },
    {
      name: 'Smoked Turkey Breast',
      description: 'Tender, flavorful smoked turkey breast sliced to order.',
      basePriceCents: 1600,
      imageUrl: 'https://images.unsplash.com/photo-1574672280600-4accfa5b6f98?w=800',
      category: 'mains',
      sortOrder: 5
    },
    {
      name: 'Sausage Link Plate',
      description: 'House-made smoked sausage with signature spice blend. Two links per order.',
      basePriceCents: 1300,
      imageUrl: 'https://images.unsplash.com/photo-1612892483236-52d32a0e0ac1?w=800',
      category: 'mains',
      sortOrder: 6
    },
    {
      name: 'BBQ Combo Platter',
      description: 'Your choice of three meats. Perfect for sampling the best of our smokehouse.',
      basePriceCents: 2800,
      imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800',
      category: 'mains',
      sortOrder: 7,
      isFeatured: true
    },

    // SANDWICHES (5 items)
    {
      name: 'Pulled Pork Sandwich',
      description: 'Hand-pulled pork shoulder piled high on brioche bun with ember aioli and crispy slaw.',
      basePriceCents: 1600,
      imageUrl: 'https://images.unsplash.com/photo-1619979088041-e46b5163a47b?w=800',
      category: 'sandwiches',
      sortOrder: 1,
      customizations: [
        { name: 'Add Cheese', priceCents: 150 },
        { name: 'Extra Meat', priceCents: 400 },
        { name: 'Make it Spicy', priceCents: 0 }
      ]
    },
    {
      name: 'Brisket Sandwich',
      description: 'Sliced brisket on Texas toast with pickles, onions, and house BBQ sauce.',
      basePriceCents: 1800,
      imageUrl: 'https://images.unsplash.com/photo-1550950158-d0d960dff51b?w=800',
      category: 'sandwiches',
      sortOrder: 2,
      customizations: [
        { name: 'Add Cheese', priceCents: 150 },
        { name: 'Extra Meat', priceCents: 500 }
      ]
    },
    {
      name: 'Chicken Sandwich',
      description: 'Smoked chicken breast with honey mustard, lettuce, and tomato on brioche.',
      basePriceCents: 1400,
      imageUrl: 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=800',
      category: 'sandwiches',
      sortOrder: 3
    },
    {
      name: 'Sausage Po\' Boy',
      description: 'Smoked sausage on French bread with peppers, onions, and Creole mustard.',
      basePriceCents: 1500,
      imageUrl: 'https://images.unsplash.com/photo-1619740455993-9e869d7e3148?w=800',
      category: 'sandwiches',
      sortOrder: 4
    },
    {
      name: 'Burnt Ends Sandwich',
      description: 'Caramelized brisket burnt ends with pickles and BBQ sauce on pretzel bun.',
      basePriceCents: 1900,
      imageUrl: 'https://images.unsplash.com/photo-1568641120318-f4c1c76d75dd?w=800',
      category: 'sandwiches',
      sortOrder: 5
    },

    // SIDES (7 items)
    {
      name: 'Loaded Mac & Cheese',
      description: 'Smoked gouda mac topped with burnt ends and crispy onions.',
      basePriceCents: 800,
      imageUrl: 'https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?w=800',
      category: 'sides',
      sortOrder: 1,
      isFeatured: true
    },
    {
      name: 'Classic Coleslaw',
      description: 'Creamy coleslaw with cabbage, carrots, and tangy dressing.',
      basePriceCents: 500,
      imageUrl: 'https://images.unsplash.com/photo-1625937286074-9ca519d5d9df?w=800',
      category: 'sides',
      sortOrder: 2
    },
    {
      name: 'Pit Beans',
      description: 'Slow-cooked beans with bacon, molasses, and BBQ spices.',
      basePriceCents: 600,
      imageUrl: 'https://images.unsplash.com/photo-1589621316382-008455b857cd?w=800',
      category: 'sides',
      sortOrder: 3
    },
    {
      name: 'Cornbread',
      description: 'Sweet, buttery cornbread baked fresh daily.',
      basePriceCents: 400,
      imageUrl: 'https://images.unsplash.com/photo-1618164436241-4473940d1f5c?w=800',
      category: 'sides',
      sortOrder: 4
    },
    {
      name: 'Collard Greens',
      description: 'Southern-style collard greens with smoked ham hock.',
      basePriceCents: 600,
      imageUrl: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=800',
      category: 'sides',
      sortOrder: 5
    },
    {
      name: 'Potato Salad',
      description: 'Classic potato salad with mayo, mustard, and celery.',
      basePriceCents: 500,
      imageUrl: 'https://images.unsplash.com/photo-1623399513618-f934f1b70ff0?w=800',
      category: 'sides',
      sortOrder: 6
    },
    {
      name: 'Fried Okra',
      description: 'Crispy fried okra with a hint of cayenne.',
      basePriceCents: 600,
      imageUrl: 'https://images.unsplash.com/photo-1616662084197-8a6248f52a67?w=800',
      category: 'sides',
      sortOrder: 7
    },

    // DRINKS (5 items)
    {
      name: 'Sweet Tea',
      description: 'Southern-style sweet tea brewed fresh daily.',
      basePriceCents: 300,
      imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800',
      category: 'drinks',
      sortOrder: 1,
      customizations: [
        { name: 'Unsweetened', priceCents: 0 },
        { name: 'Extra Lemon', priceCents: 50 }
      ]
    },
    {
      name: 'Fresh Lemonade',
      description: 'House-made lemonade with real lemons.',
      basePriceCents: 350,
      imageUrl: 'https://images.unsplash.com/photo-1523677011781-c91d1bbe2f9e?w=800',
      category: 'drinks',
      sortOrder: 2
    },
    {
      name: 'Craft Root Beer',
      description: 'Small-batch root beer with vanilla notes.',
      basePriceCents: 400,
      imageUrl: 'https://images.unsplash.com/photo-1581636625402-29b2a704ef13?w=800',
      category: 'drinks',
      sortOrder: 3
    },
    {
      name: 'Bottled Water',
      description: 'Chilled spring water.',
      basePriceCents: 200,
      imageUrl: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=800',
      category: 'drinks',
      sortOrder: 4
    },
    {
      name: 'Arnold Palmer',
      description: 'Perfect blend of sweet tea and lemonade.',
      basePriceCents: 350,
      imageUrl: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=800',
      category: 'drinks',
      sortOrder: 5
    },

    // DESSERTS (4 items)
    {
      name: 'Banana Pudding',
      description: 'Classic Southern banana pudding with vanilla wafers and whipped cream.',
      basePriceCents: 700,
      imageUrl: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=800',
      category: 'desserts',
      sortOrder: 1
    },
    {
      name: 'Peach Cobbler',
      description: 'Warm peach cobbler with buttery crust. Served with vanilla ice cream.',
      basePriceCents: 800,
      imageUrl: 'https://images.unsplash.com/photo-1624114503821-937db7d16c0d?w=800',
      category: 'desserts',
      sortOrder: 2
    },
    {
      name: 'Pecan Pie Slice',
      description: 'Traditional pecan pie with brown sugar and bourbon.',
      basePriceCents: 750,
      imageUrl: 'https://images.unsplash.com/photo-1535920527002-b35e96722eb9?w=800',
      category: 'desserts',
      sortOrder: 3
    },
    {
      name: 'Chocolate Brownie',
      description: 'Fudgy brownie with walnuts and chocolate chips.',
      basePriceCents: 600,
      imageUrl: 'https://images.unsplash.com/photo-1607920591413-4ec007e70023?w=800',
      category: 'desserts',
      sortOrder: 4
    },

    // COMBOS / SPECIALS (3 items)
    {
      name: '2-Meat Combo',
      description: 'Your choice of two meats with two sides and cornbread.',
      basePriceCents: 2200,
      imageUrl: 'https://images.unsplash.com/photo-1558030006-450675393462?w=800',
      category: 'combos',
      sortOrder: 1
    },
    {
      name: 'Family Pack',
      description: '2 lbs of meat (mix & match), 4 sides, and 6 pieces of cornbread. Feeds 4-6.',
      basePriceCents: 5500,
      imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800',
      category: 'combos',
      sortOrder: 2
    },
    {
      name: 'Tailgate Pack',
      description: '3 lbs of mixed meats, 6 sides, 12 pieces of cornbread. Feeds 6-8.',
      basePriceCents: 7500,
      imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
      category: 'combos',
      sortOrder: 3
    },

    // KIDS MENU (3 items)
    {
      name: 'Kids Pulled Pork',
      description: 'Pulled pork slider with one side and a drink.',
      basePriceCents: 900,
      imageUrl: 'https://images.unsplash.com/photo-1619740455993-9e869d7e3148?w=800',
      category: 'kids',
      sortOrder: 1
    },
    {
      name: 'Kids Chicken Tenders',
      description: 'Three smoked chicken tenders with one side and a drink.',
      basePriceCents: 850,
      imageUrl: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=800',
      category: 'kids',
      sortOrder: 2
    },
    {
      name: 'Kids Mac & Cheese Bowl',
      description: 'Creamy mac & cheese bowl with a drink and cookie.',
      basePriceCents: 800,
      imageUrl: 'https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?w=800',
      category: 'kids',
      sortOrder: 3
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
}

seedMenu()
  .catch((e) => {
    console.error('Error seeding menu:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
