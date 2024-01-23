varying vec2 oTexCoord;
void main()	
{
	oTexCoord = uv;
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
