// classes you may find useful.  Feel free to change them if you don't like the way
// they are set up.

export class Vector {
    constructor(public x: number,
                public y: number,
                public z: number) {
    }
    static times(k: number, v: Vector) { return new Vector(k * v.x, k * v.y, k * v.z); }
    static minus(v1: Vector, v2: Vector) { return new Vector(v1.x - v2.x, v1.y - v2.y, v1.z - v2.z); }
    static plus(v1: Vector, v2: Vector) { return new Vector(v1.x + v2.x, v1.y + v2.y, v1.z + v2.z); }
    static dot(v1: Vector, v2: Vector) { return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z; }
    static mag(v: Vector) { return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z); }
    static norm(v: Vector) {
        var mag = Vector.mag(v);
        var div = (mag === 0) ? Infinity : 1.0 / mag;
        return Vector.times(div, v);
    }
    static cross(v1: Vector, v2: Vector) {
        return new Vector(v1.y * v2.z - v1.z * v2.y,
                          v1.z * v2.x - v1.x * v2.z,
                          v1.x * v2.y - v1.y * v2.x);
    }
}

export class Color {
    constructor(public r: number,
                public g: number,
                public b: number) {
    }
    static scale(k: number, v: Color) { return new Color(k * v.r, k * v.g, k * v.b); }
    static plus(v1: Color, v2: Color) { return new Color(v1.r + v2.r, v1.g + v2.g, v1.b + v2.b); }
    static times(v1: Color, v2: Color) { return new Color(v1.r * v2.r, v1.g * v2.g, v1.b * v2.b); }
    static scalartimes(k: number, v: Color) { return new Color(k * v.r, k * v.g, k * v.b); }
    static white = new Color(1.0, 1.0, 1.0);
    static grey = new Color(0.5, 0.5, 0.5);
    static black = new Color(0.0, 0.0, 0.0);
    static toDrawingColor(c: Color) {
        var legalize = (d: number) => d > 1 ? 1 : d;
        return {
            r: Math.floor(legalize(c.r) * 255),
            g: Math.floor(legalize(c.g) * 255),
            b: Math.floor(legalize(c.b) * 255)
        }
    }
}

interface light {
    color: Color;
    pos: Vector;
}

interface Ray {
    start: Vector;
    dir: Vector;
}

interface Eye {
    u: Vector;
    v: Vector;
    w: Vector;
    pos: Vector;
}

interface sphere {
    pos: Vector;
    radius: number; 
    color: Color; 
    k_ambient: number; 
    k_specular: number; 
    specular_pow: number;
}

// A class for our application state and functionality
class RayTracer {
    // the constructor paramater "canv" is automatically created 
    // as a property because the parameter is marked "public" in the 
    // constructor parameter
    // canv: HTMLCanvasElement
    //
    // rendering context for the canvas, also public
    // ctx: CanvasRenderingContext2D

    // initial color we'll use for the canvas
    canvasColor = "lightyellow"

    canv: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
    pointlights: light[]
    ambientligh: light
    ambient:boolean
    backgroundcolor: Color
    fov: number;
    eye: Eye;
    spheres: sphere[];

    // div is the HTMLElement we'll add our canvas to
    // width, height are the size of the canvas
    // screenWidth, screenHeight are the number of pixels you want to ray trace
    //  (recommend that width and height are multiples of screenWidth and screenHeight)
    constructor (div: HTMLElement,
        public width: number, public height: number, 
        public screenWidth: number, public screenHeight: number) {

        // let's create a canvas and to draw in
        this.canv = document.createElement("canvas");
        this.ctx = this.canv.getContext("2d")!;

        this.pointlights = []
        this.ambientligh = {color:Color.white, pos:new Vector(0,0,0)}
        this.backgroundcolor = Color.grey
        this.ambient = false
        this.fov = 90
        this.eye = {u:new Vector(0,0,0), v:new Vector(0,0,-1), w:new Vector(0,1,0), pos:new Vector(0,0,0)}
        this.spheres = []

        if (!this.ctx) {
            console.warn("our drawing element does not have a 2d drawing context")
            return
        }
 
        div.appendChild(this.canv);

        this.canv.id = "main";
        this.canv.style.width = this.width.toString() + "px";
        this.canv.style.height = this.height.toString() + "px";
        this.canv.width  = this.width;
        this.canv.height = this.height;
    }

    // API Functions you should implement

    // clear out all scene contents
    reset_scene() {
        this.clear_screen();
        this.pointlights = []
        this.ambientligh = {color:Color.white, pos:new Vector(0,0,0)}
        this.backgroundcolor = Color.grey
        this.set_eye(0,0,0,0,0,-1,0,1,0)
        this.spheres = []
        this.ambient = false

    }

    // create a new point light source
    new_light (r: number, g: number, b: number, x: number, y: number, z: number) {

        var newlight:light = {color:new Color(r,g,b), pos:new Vector(x, y, z)}
        this.pointlights.push(newlight)
    }

    // set value of ambient light source
    ambient_light (r: number, g: number, b: number) {
    
        var newlight:light = {color:new Color(r,g,b), pos:new Vector(0, 0, 0)}
        this.ambientligh = newlight
        this.ambient = true
    }

    // set the background color for the scene
    set_background (r: number, g: number, b: number) {
        this.backgroundcolor = new Color(r, g, b)
    }

    // set the field of view
    DEG2RAD = (Math.PI/180)
    set_fov (theta: number) {
        this.fov = theta
    }

    // set the virtual camera's position and orientation
    // x1,y1,z1 are the camera position
    // x2,y2,z2 are the lookat position
    // x3,y3,z3 are the up vector
    set_eye(x1: number, y1: number, z1: number, 
            x2: number, y2: number, z2: number, 
            x3: number, y3: number, z3: number) {
        
        var w:Vector = new Vector(-(x2 - x1), -(y2 - y1), -(z2 - z1))
        w = Vector.norm(w)
        var v:Vector = new Vector(x3,y3,z3)
        // v = Vector.norm(v)
        var u:Vector = Vector.cross(v, w)
        u = Vector.norm(u)
        v = Vector.cross(u, w)
        v = Vector.norm(v)
        var pos:Vector = new Vector(x1,y1,z1)
        this.eye = {u:u, v:v, w:w, pos:pos}
        
    }

    // create a new sphere
    new_sphere (x: number, y: number, z: number, radius: number, 
                dr: number, dg: number, db: number, 
                k_ambient: number, k_specular: number, specular_pow: number) {
        
        var pos = new Vector(x,y,z)
        var current:sphere = {pos:pos, radius: radius, color: new Color(dr,dg,db), 
            k_ambient: k_ambient, k_specular: k_specular, specular_pow: specular_pow}
        this.spheres.push(current)

    }

    // INTERNAL METHODS YOU MUST IMPLEMENT

    // create an eye ray based on the current pixel's position
    private eyeRay(i: number, j: number): Ray {
        var d:number = -1/Math.tan(this.DEG2RAD*this.fov/2)
        var us:number = -1 + 2*i/this.screenWidth + 1/this.screenWidth
        var vs:number = -1 + 2*j/this.screenHeight + 1/this.screenHeight
        // var us:number = -1 + 2*i/this.screenWidth
        // var vs:number = -1 + 2*j/this.screenHeight
        var dir:Vector = Vector.plus(
            Vector.plus(
                Vector.times(us, this.eye.u), 
                Vector.times(vs, this.eye.v)
            )
            , 
            Vector.times(d, this.eye.w)
        )
        dir = Vector.norm(dir)
        var output:Ray = {start:this.eye.pos, dir:dir}
        return output
        
    }

    private traceRay(ray: Ray, depth: number = 0): Color {
        var record:sphere = this.spheres[0]
        var recordT:number = 9999999
        var e = ray.start
        var d = ray.dir
        this.spheres.forEach(function (sphere) {
            var c = sphere.pos
            var R = sphere.radius
            var eMc = Vector.minus(e, c)
            //check b^2-4ac
            var b = Vector.dot(d, eMc)
            var bSquare = Math.pow(b, 2)
            var ac = Vector.dot(d, d) * (Vector.dot(eMc, eMc) - R*R)
            var check = (bSquare - ac)
            if (check >= 0) {  
                var currentT1:number = (-b + Math.sqrt(check))/Vector.dot(d,d)
                var currentT2:number = (-b - Math.sqrt(check))/Vector.dot(d,d)
                if (check == 0) {
                    if (currentT2 < recordT) {
                        recordT = currentT2
                        record = sphere    
                    }
                }else{
                    var min:number = 0
                    if (currentT1 > currentT2) {
                        min = currentT2                        
                    }else{
                        min = currentT1
                    }
                    if (min < recordT) {  
                        recordT = min      
                        record = sphere                  
                    }
                }
            }
        })


        if(recordT == 9999999){
            return this.backgroundcolor
        }else{
            var sum = new Color(0,0,0)
            var point = Vector.plus(e, Vector.times(recordT, d))
            // var n = Vector.times(1/record.radius, Vector.minus(point, record.pos))
            var n = Vector.minus(point, record.pos)
            n = Vector.norm(n)
            var kd = record.color
            var ka = record.k_ambient
            var ks = new Color(record.k_specular, record.k_specular, record.k_specular)
            var sp = record.specular_pow
            var V = ray.dir
            V = Vector.times(-1, V)
            V = Vector.norm(V)
            this.pointlights.forEach(function(light){
                var l = Vector.minus(light.pos, point)
                l = Vector.norm(l)
                var Ri = Vector.minus(
                    Vector.times(2, Vector.times(Vector.dot(l, n), n)),
                    l
                )
                Ri = Vector.norm(Ri)
                
                var Riv = Vector.dot(Ri, V)

                if (Vector.dot(Ri,l) <= 0) {
                    Riv = 0
                }

                var Rivpi = Math.pow(Riv, sp)

                var specular = Color.scalartimes(Rivpi, ks)

                var diffuse = Color.scalartimes(Vector.dot(n,l), kd)
                
                var finalsum = Color.plus(specular, diffuse)

                var final = Color.times(light.color, finalsum)

                sum = Color.plus(final, sum)
            })

            var ambientColor = this.ambientligh.color
            if(this.ambient == true){
                sum = Color.plus(sum, Color.times(Color.scalartimes(ka, ambientColor), kd))
            }

            return sum
        }

        
    }

    // draw_scene is provided to create the image from the ray traced colors. 
    // 1. it renders 1 line at a time, and uses requestAnimationFrame(render) to schedule 
    //    the next line.  This causes the lines to be displayed as they are rendered.
    // 2. it uses the additional constructor parameters to allow it to render a  
    //    smaller # of pixels than the size of the canvas
    draw_scene() {

        // rather than doing a for loop for y, we're going to draw each line in
        // an animationRequestFrame callback, so we see them update 1 by 1
        var pixelWidth = this.width / this.screenWidth;
        var pixelHeight = this.height / this.screenHeight;
        var y = 0;
        
        this.clear_screen();

        var renderRow = () => {
            for (var x = 0; x < this.screenWidth; x++) {

                var ray = this.eyeRay(x, y);
                console.log(ray)
                var c = this.traceRay(ray);

                var color = Color.toDrawingColor(c)
                this.ctx.fillStyle = "rgb(" + String(color.r) + ", " + String(color.g) + ", " + String(color.b) + ")";
                this.ctx.fillRect(x * pixelWidth, y * pixelHeight, pixelWidth+1, pixelHeight+1);
            }
            
            // finished the row, so increment row # and see if we are done
            y++;
            if (y < this.screenHeight) {
                // finished a line, do another
                requestAnimationFrame(renderRow);            
            } else {
                console.log("Finished rendering scene")
            }
        }

        renderRow();
    }

    clear_screen() {
        this.ctx.fillStyle = this.canvasColor;
        this.ctx.fillRect(0, 0, this.canv.width, this.canv.height);

    }
}
export {RayTracer}