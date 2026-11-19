/** Registers the JSON face of StructuredField (#5333): imported by '@quazardous/qdadm/editors/json' */
import { registerStructuredFace } from './faces'
import JsonRawFace from './JsonRawFace.vue'

registerStructuredFace('json', JsonRawFace)
