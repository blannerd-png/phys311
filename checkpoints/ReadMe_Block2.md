## Block 2 Checkpoint - Four Body Simulation

Brianna Lannerd
PHYS 311- Block 2 CheckPoint Readme
10/18/2026

### Overview
This block 2 checkpoint demonstrates a physics simulation that has for bodies and relies on the base engine from mlab 7. The simulation components include four disks with varying masses and initial velocities that interact through springs and elastic collissions. Gravity is also acting on the disks.

### Basic Architecture
Body, World, Gravity, Spring, Velocity Verlet approximation, and collision function

### INitial Paramters
4 bodies
masses from .9 to 1.3 kg
Radius: 22m for each body
Bodies are connected by springs
Bodies are acted upon by gravity
Collisions are modeled elastically (KE and momentum should be conserved)

### Validation/Testing of accurateness

KE, PE, and Total ME plot
Relative Error Plot

### Running the simulation
 1. Open phys 311 folder
 2. active virtual environment
 3. cd into checkpoints folder
 4. use terminal to run python file "Block_Checkpoint2.py"
 4. Results should be 3 PNGS.