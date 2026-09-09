import { Router, Response } from 'express';
import { db, UnitType } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../auth.js';

const router = Router();

// Protect all project routes
router.use(requireAuth);

// GET /api/projects - list user's projects
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const projects = await db.getProjectsForUser(userId);
    res.json({ projects });
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: 'Failed to retrieve projects.' });
  }
});

// POST /api/projects - create new project
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, description, units, metadata } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Project name is required.' });
      return;
    }

    const validUnits: UnitType[] = ['mm', 'cm', 'm', 'in', 'ft'];
    const projectUnits = validUnits.includes(units) ? units : 'mm';

    const project = await db.createProject({
      ownerId: userId,
      name: name.trim(),
      description: description?.trim(),
      units: projectUnits,
      metadata,
    });

    res.status(201).json({ project });
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).json({ error: 'Failed to create project.' });
  }
});

// GET /api/projects/:id - get single project (strictly owned by req.user)
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const project = await db.getProjectById(id);
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    if (project.ownerId !== userId) {
      res.status(403).json({ error: 'Access denied. You do not have permission to view this project.' });
      return;
    }

    res.json({ project });
  } catch (err) {
    console.error('Error retrieving project:', err);
    res.status(500).json({ error: 'Failed to retrieve project.' });
  }
});

// PATCH /api/projects/:id - update project details (name, description, units, metadata)
router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { name, description, units, metadata, drawingData } = req.body;

    const existing = await db.getProjectById(id);
    if (!existing) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    if (existing.ownerId !== userId) {
      res.status(403).json({ error: 'Access denied. You do not have permission to edit this project.' });
      return;
    }

    const updated = await db.updateProject(id, {
      name,
      description,
      units,
      metadata,
      drawingData,
    });

    res.json({ project: updated });
  } catch (err) {
    console.error('Error updating project:', err);
    res.status(500).json({ error: 'Failed to update project.' });
  }
});

// DELETE /api/projects/:id - delete project
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const existing = await db.getProjectById(id);
    if (!existing) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    if (existing.ownerId !== userId) {
      res.status(403).json({ error: 'Access denied. You do not have permission to delete this project.' });
      return;
    }

    await db.deleteProject(id);
    res.json({ message: 'Project successfully deleted.' });
  } catch (err) {
    console.error('Error deleting project:', err);
    res.status(500).json({ error: 'Failed to delete project.' });
  }
});

// POST /api/projects/:id/duplicate - duplicate project
router.post('/:id/duplicate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const existing = await db.getProjectById(id);
    if (!existing) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    if (existing.ownerId !== userId) {
      res.status(403).json({ error: 'Access denied. You do not have permission to duplicate this project.' });
      return;
    }

    const duplicated = await db.duplicateProject(id, userId);
    res.status(201).json({ project: duplicated });
  } catch (err) {
    console.error('Error duplicating project:', err);
    res.status(500).json({ error: 'Failed to duplicate project.' });
  }
});

// POST /api/projects/:id/save - save drawing version & update current drawingData
router.post('/:id/save', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { drawingData, description } = req.body;

    if (!drawingData) {
      res.status(400).json({ error: 'drawingData payload is required.' });
      return;
    }

    const existing = await db.getProjectById(id);
    if (!existing) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    if (existing.ownerId !== userId) {
      res.status(403).json({ error: 'Access denied. You do not have permission to save to this project.' });
      return;
    }

    const result = await db.saveProjectVersion(
      id,
      userId,
      drawingData,
      description || 'Explicit save'
    );

    res.json({
      message: 'Project version successfully saved.',
      project: result?.project,
      version: result?.version,
    });
  } catch (err) {
    console.error('Error saving project version:', err);
    res.status(500).json({ error: 'Failed to save project.' });
  }
});

// GET /api/projects/:id/versions - get all versions for a project
router.get('/:id/versions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const existing = await db.getProjectById(id);
    if (!existing) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    if (existing.ownerId !== userId) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const versions = await db.getProjectVersions(id);
    res.json({ versions });
  } catch (err) {
    console.error('Error fetching project versions:', err);
    res.status(500).json({ error: 'Failed to retrieve versions.' });
  }
});

export default router;
