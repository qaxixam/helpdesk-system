
import mongoose, { Schema } from "mongoose";

const categorySchema = new Schema(
    {
        name: {
            type: String,
            required: [true, "Category name is required"],
            unique: true,
            trim: true,
            minlength: 2,
            maxlength: 80,
        },

        description: {
            type: String,
            trim: true,
            maxlength: 300,
            default: "",
        },

        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

const Category =
    mongoose.models.Category ||
    mongoose.model("Category", categorySchema);

export default Category;
