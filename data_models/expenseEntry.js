const mongoose = require("mongoose");

var expenseEntrySchema = mongoose.Schema({
    expenseCategory: {
        type: mongoose.Types.ObjectId,
        ref: "ExpenseCategory"
    },
    date: {
        type: String,
    },
    amount: {
        type: Number,
    },
    description: {
        type: String,
    }
});

module.exports = mongoose.model("Expenses", expenseEntrySchema);