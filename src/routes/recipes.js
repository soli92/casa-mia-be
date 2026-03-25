import express from 'express';
import { prisma } from '../utils/prisma.js';

const router = express.Router();

// Ottieni ricette suggerite in base alla dispensa
router.get('/suggestions', async (req, res) => {
  try {
    // Ottieni prodotti disponibili in dispensa
    const pantryItems = await prisma.pantryItem.findMany({
      where: {
        familyId: req.user.familyId,
        quantity: { gt: 0 },
      },
      select: { name: true, status: true, expirationDate: true },
    });

    const availableIngredients = pantryItems.map(item => item.name.toLowerCase());

    // Ottieni tutte le ricette
    const allRecipes = await prisma.recipe.findMany({
      where: { familyId: req.user.familyId },
    });

    // Calcola match per ogni ricetta
    const recipeSuggestions = allRecipes.map(recipe => {
      const recipeIngredients = recipe.ingredients.map(ing => ing.toLowerCase());
      
      const available = recipeIngredients.filter(ing => 
        availableIngredients.some(avail => avail.includes(ing) || ing.includes(avail))
      );
      
      const missing = recipeIngredients.filter(ing => 
        !availableIngredients.some(avail => avail.includes(ing) || ing.includes(avail))
      );

      const matchPercentage = (available.length / recipeIngredients.length) * 100;

      // Priorità prodotti in scadenza
      const hasExpiringIngredients = available.some(ing => {
        const pantryItem = pantryItems.find(p => 
          p.name.toLowerCase().includes(ing) || ing.includes(p.name.toLowerCase())
        );
        return pantryItem && pantryItem.status === 'EXPIRING_SOON';
      });

      return {
        ...recipe,
        availableIngredients: available,
        missingIngredients: missing,
        matchPercentage: Math.round(matchPercentage),
        hasExpiringIngredients,
        priority: hasExpiringIngredients ? 1 : 0,
      };
    });

    // Ordina per priorità (scadenza) poi per match percentage
    recipeSuggestions.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.matchPercentage - a.matchPercentage;
    });

    res.json(recipeSuggestions);
  } catch (error) {
    console.error('Get recipe suggestions error:', error);
    res.status(500).json({ error: 'Errore durante il recupero dei suggerimenti' });
  }
});

// Ottieni tutte le ricette
router.get('/', async (req, res) => {
  try {
    const recipes = await prisma.recipe.findMany({
      where: { familyId: req.user.familyId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(recipes);
  } catch (error) {
    console.error('Get recipes error:', error);
    res.status(500).json({ error: 'Errore durante il recupero delle ricette' });
  }
});

// Ottieni singola ricetta
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const recipe = await prisma.recipe.findUnique({
      where: { id },
      include: {
        views: {
          include: { user: { select: { name: true } } },
          orderBy: { viewedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!recipe || recipe.familyId !== req.user.familyId) {
      return res.status(404).json({ error: 'Ricetta non trovata' });
    }

    // Registra visualizzazione
    await prisma.recipeView.create({
      data: {
        recipeId: id,
        userId: req.user.id,
      },
    });

    res.json(recipe);
  } catch (error) {
    console.error('Get recipe error:', error);
    res.status(500).json({ error: 'Errore durante il recupero della ricetta' });
  }
});

// Crea ricetta
router.post('/', async (req, res) => {
  try {
    const { name, ingredients, instructions, prepTime } = req.body;

    if (!name || !ingredients || !instructions) {
      return res.status(400).json({ error: 'Nome, ingredienti e istruzioni obbligatori' });
    }

    if (!Array.isArray(ingredients)) {
      return res.status(400).json({ error: 'Ingredienti deve essere un array' });
    }

    const recipe = await prisma.recipe.create({
      data: {
        name,
        ingredients,
        instructions,
        prepTime: prepTime ? parseInt(prepTime) : null,
        familyId: req.user.familyId,
      },
    });

    res.status(201).json(recipe);
  } catch (error) {
    console.error('Create recipe error:', error);
    res.status(500).json({ error: 'Errore durante la creazione della ricetta' });
  }
});

// Aggiorna ricetta
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, ingredients, instructions, prepTime } = req.body;

    const recipe = await prisma.recipe.findUnique({ where: { id } });
    if (!recipe || recipe.familyId !== req.user.familyId) {
      return res.status(404).json({ error: 'Ricetta non trovata' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (ingredients !== undefined) {
      if (!Array.isArray(ingredients)) {
        return res.status(400).json({ error: 'Ingredienti deve essere un array' });
      }
      updateData.ingredients = ingredients;
    }
    if (instructions !== undefined) updateData.instructions = instructions;
    if (prepTime !== undefined) updateData.prepTime = prepTime ? parseInt(prepTime) : null;

    const updated = await prisma.recipe.update({
      where: { id },
      data: updateData,
    });

    res.json(updated);
  } catch (error) {
    console.error('Update recipe error:', error);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento della ricetta' });
  }
});

// Elimina ricetta
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const recipe = await prisma.recipe.findUnique({ where: { id } });
    if (!recipe || recipe.familyId !== req.user.familyId) {
      return res.status(404).json({ error: 'Ricetta non trovata' });
    }

    await prisma.recipe.delete({ where: { id } });
    res.json({ message: 'Ricetta eliminata' });
  } catch (error) {
    console.error('Delete recipe error:', error);
    res.status(500).json({ error: 'Errore durante l\'eliminazione' });
  }
});

export default router;
