import fs from "fs";

const file = "d:/projects/food-portal-Rishav/scripts/seed-demo-restaurant.mjs";
let content = fs.readFileSync(file, "utf8");

const newArrays = `
  const thaiDishes = [
    { n: "Pad Thai with Shrimp", c: "Main Course", t: "Non-Veg" },
    { n: "Tom Yum Goong", c: "Soup", t: "Non-Veg" },
    { n: "Green Curry Chicken", c: "Main Course", t: "Non-Veg" },
    { n: "Som Tum Papaya Salad", c: "Salad", t: "Veg" },
    { n: "Massaman Beef Curry", c: "Main Course", t: "Non-Veg" },
    { n: "Panang Pork Curry", c: "Main Course", t: "Non-Veg" },
    { n: "Mango Sticky Rice", c: "Dessert", t: "Veg" },
    { n: "Thai Iced Tea", c: "Beverage", t: "Veg" },
    { n: "Pineapple Fried Rice", c: "Main Course", t: "Veg" },
    { n: "Chicken Satay", c: "Appetizer", t: "Non-Veg" },
    { n: "Tom Kha Gai", c: "Soup", t: "Non-Veg" },
    { n: "Spicy Basil Pork (Pad Kra Pao)", c: "Main Course", t: "Non-Veg" },
    { n: "Crispy Spring Rolls", c: "Appetizer", t: "Veg" },
    { n: "Thai Fish Cakes", c: "Appetizer", t: "Non-Veg" },
    { n: "Red Curry with Duck", c: "Main Course", t: "Non-Veg" },
    { n: "Drunken Noodles (Pad Kee Mao)", c: "Main Course", t: "Non-Veg" },
    { n: "Yellow Curry", c: "Main Course", t: "Veg" },
    { n: "Coconut Ice Cream", c: "Dessert", t: "Veg" },
    { n: "Thai Lemongrass Soup", c: "Soup", t: "Veg" },
    { n: "Pad See Ew", c: "Main Course", t: "Non-Veg" },
    { n: "Mango Salad", c: "Salad", t: "Veg" },
    { n: "Sticky Rice with Custard", c: "Dessert", t: "Veg" },
    { n: "Thai Iced Coffee", c: "Beverage", t: "Veg" },
    { n: "Fried Bananas", c: "Dessert", t: "Veg" },
    { n: "Papaya Salad with Crab", c: "Salad", t: "Non-Veg" },
    { n: "Pork Larb", c: "Salad", t: "Non-Veg" },
    { n: "Gai Yang (Grilled Chicken)", c: "Main Course", t: "Non-Veg" },
    { n: "Khao Soi", c: "Main Course", t: "Non-Veg" },
    { n: "Moo Ping (Grilled Pork Skewers)", c: "Appetizer", t: "Non-Veg" },
    { n: "Thai Green Tea", c: "Beverage", t: "Veg" }
  ];

  const italianDishes = [
    { n: "Margherita Pizza", c: "Pizza", t: "Veg" },
    { n: "Spaghetti Carbonara", c: "Pasta", t: "Non-Veg" },
    { n: "Lasagna al Forno", c: "Pasta", t: "Non-Veg" },
    { n: "Tiramisu", c: "Dessert", t: "Veg" },
    { n: "Bruschetta al Pomodoro", c: "Appetizer", t: "Veg" },
    { n: "Fettuccine Alfredo", c: "Pasta", t: "Veg" },
    { n: "Risotto ai Funghi", c: "Main Course", t: "Veg" },
    { n: "Caprese Salad", c: "Salad", t: "Veg" },
    { n: "Penne Arrabbiata", c: "Pasta", t: "Veg" },
    { n: "Chicken Parmesan", c: "Main Course", t: "Non-Veg" },
    { n: "Gelato (Chocolate)", c: "Dessert", t: "Veg" },
    { n: "Garlic Bread", c: "Bread", t: "Veg" },
    { n: "Minestrone Soup", c: "Soup", t: "Veg" },
    { n: "Gnocchi with Pesto", c: "Pasta", t: "Veg" },
    { n: "Ravioli Ricotta e Spinaci", c: "Pasta", t: "Veg" },
    { n: "Eggplant Parmigiana", c: "Main Course", t: "Veg" },
    { n: "Calzone", c: "Pizza", t: "Non-Veg" },
    { n: "Prosciutto e Melone", c: "Appetizer", t: "Non-Veg" },
    { n: "Panna Cotta", c: "Dessert", t: "Veg" },
    { n: "Cannoli", c: "Dessert", t: "Veg" },
    { n: "Linguine alle Vongole", c: "Pasta", t: "Non-Veg" },
    { n: "Veal Milanese", c: "Main Course", t: "Non-Veg" },
    { n: "Ossobuco", c: "Main Course", t: "Non-Veg" },
    { n: "Focaccia", c: "Bread", t: "Veg" },
    { n: "Pepperoni Pizza", c: "Pizza", t: "Non-Veg" },
    { n: "Quattro Formaggi Pizza", c: "Pizza", t: "Veg" },
    { n: "Aperol Spritz", c: "Beverage", t: "Veg" },
    { n: "Espresso", c: "Beverage", t: "Veg" },
    { n: "Affogato", c: "Dessert", t: "Veg" },
    { n: "Biscotti", c: "Dessert", t: "Veg" }
  ];

  const indianDishes = [
    { n: "Butter Chicken", c: "Main Course", t: "Non-Veg" },
    { n: "Garlic Naan", c: "Bread", t: "Veg" },
    { n: "Chicken Biryani", c: "Main Course", t: "Non-Veg" },
    { n: "Vegetable Samosa", c: "Appetizer", t: "Veg" },
    { n: "Mango Lassi", c: "Beverage", t: "Veg" },
    { n: "Paneer Tikka Masala", c: "Main Course", t: "Veg" },
    { n: "Chana Masala", c: "Main Course", t: "Veg" },
    { n: "Palak Paneer", c: "Main Course", t: "Veg" },
    { n: "Aloo Gobi", c: "Main Course", t: "Veg" },
    { n: "Tandoori Chicken", c: "Main Course", t: "Non-Veg" },
    { n: "Dal Makhani", c: "Main Course", t: "Veg" },
    { n: "Lamb Rogan Josh", c: "Main Course", t: "Non-Veg" },
    { n: "Gulab Jamun", c: "Dessert", t: "Veg" },
    { n: "Rasmalai", c: "Dessert", t: "Veg" },
    { n: "Masala Chai", c: "Beverage", t: "Veg" },
    { n: "Onion Bhaji", c: "Appetizer", t: "Veg" },
    { n: "Fish Curry", c: "Main Course", t: "Non-Veg" },
    { n: "Prawn Vindaloo", c: "Main Course", t: "Non-Veg" },
    { n: "Keema Naan", c: "Bread", t: "Non-Veg" },
    { n: "Peshawari Naan", c: "Bread", t: "Veg" },
    { n: "Mutter Paneer", c: "Main Course", t: "Veg" },
    { n: "Chicken Korma", c: "Main Course", t: "Non-Veg" },
    { n: "Malai Kofta", c: "Main Course", t: "Veg" },
    { n: "Saag Aloo", c: "Main Course", t: "Veg" },
    { n: "Pani Puri", c: "Appetizer", t: "Veg" },
    { n: "Chicken Tikka", c: "Appetizer", t: "Non-Veg" },
    { n: "Vegetable Pakora", c: "Appetizer", t: "Veg" },
    { n: "Jeera Rice", c: "Main Course", t: "Veg" },
    { n: "Raita", c: "Appetizer", t: "Veg" },
    { n: "Sweet Lassi", c: "Beverage", t: "Veg" }
  ];

  // Generator for Thai
  thaiDishes.forEach((item, idx) => {
    const i = idx + 1;
    menuItems.push({
      id: \`demo-thai-\${i}\`,
      itemName: item.n,
      price: 100 + (i * 5),
      discount: i % 5 === 0 ? 10 : 0,
      category: item.c,
      itemType: item.t,
      cuisine: "Thai",
      description: \`Authentic traditional \${item.n}, made with fresh ingredients.\`,
      imageUrl: IMG[Object.keys(IMG)[i % 12 + 1]],
      active: i !== 29,
      count: i * 2,
      earning: i * 200,
    });
  });

  // Generator for Italian
  italianDishes.forEach((item, idx) => {
    const i = idx + 1;
    menuItems.push({
      id: \`demo-ita-\${i}\`,
      itemName: item.n,
      price: 150 + (i * 8),
      discount: i % 4 === 0 ? 15 : 0,
      category: item.c,
      itemType: item.t,
      cuisine: "Italian",
      description: \`Classic Italian \${item.n}, crafted from a family recipe.\`,
      imageUrl: IMG[Object.keys(IMG)[(i % 5) + 12]],
      active: true,
      count: i * 3,
      earning: i * 300,
    });
  });

  // Generator for Indian
  indianDishes.forEach((item, idx) => {
    const i = idx + 1;
    menuItems.push({
      id: \`demo-ind-\${i}\`,
      itemName: item.n,
      price: 120 + (i * 6),
      discount: i % 6 === 0 ? 20 : 0,
      category: item.c,
      itemType: item.t,
      cuisine: "Indian",
      description: \`Flavorful and aromatic \${item.n}, cooked to perfection.\`,
      imageUrl: IMG[Object.keys(IMG)[(i % 5) + 17]],
      active: true,
      count: i * 1,
      earning: i * 150,
    });
  });

  // Edge cases (Removed)
  // menuItems.push(...);`;

const regex = /const thaiDishes = \[[\s\S]*?\/\/ Edge cases[\s\S]*?\);/g;
const match = content.match(regex);
if (!match) {
  console.log("Could not find array blocks to replace.");
} else {
  content = content.replace(regex, newArrays.trim());
  fs.writeFileSync(file, content);
  console.log("Replaced arrays successfully.");
}
