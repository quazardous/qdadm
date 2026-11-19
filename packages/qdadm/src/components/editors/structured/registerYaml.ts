/** Registers the YAML face of StructuredField (#5333): imported by '@quazardous/qdadm/editors/yaml' */
import { registerStructuredFace } from './faces'
import YamlRawFace from './YamlRawFace.vue'

registerStructuredFace('yaml', YamlRawFace)
